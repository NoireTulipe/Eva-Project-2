/**
 * instagram-planif.cron.js — EVA génère automatiquement les posts planifiés
 *
 * Toutes les heures, EVA :
 * 1. Cherche les planifications dont datePost <= now + 24h et statut = 'planifie'
 * 2. Génère le texte via Mistral (sujet + instructions du template)
 * 3. Crée un IgPost avec les textes injectés dans le template
 * 4. Rend la vignette en PNG via node-canvas
 * 5. Envoie sur Discord #validation-insta pour validation
 * 6. Met à jour la planification : statut = 'propose'
 */

import prisma             from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'
import { callAI }         from '../llm/providers.js'
import { renderPostToPng } from '../modules/instagram/instagram.renderer.js'
import { updatePlanification } from '../modules/instagram/instagram.service.js'
import { envoyerValidationDiscord } from '../discord/instagram.discord.js'

let _cronHandle = null

export function startInstagramPlanifCron() {
  logAction('Instagram planif cron: démarré — vérification toutes les heures')
  runPlanif().catch(e => logError(`Instagram planif: erreur premier run — ${e.message}`))
  _cronHandle = setInterval(() => {
    runPlanif().catch(e => logError(`Instagram planif: erreur cycle — ${e.message}`))
  }, 60 * 60 * 1000) // toutes les heures
}

export function stopInstagramPlanifCron() {
  if (_cronHandle) { clearInterval(_cronHandle); _cronHandle = null }
}

async function runPlanif() {
  // Chercher les planifications à traiter dans les 24 prochaines heures
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const planifs = await prisma.igPlanification.findMany({
    where: {
      statut:  'planifie',
      datePost: { lte: horizon },
    },
    include: { template: true },
  })

  if (!planifs.length) return

  logAction(`Instagram planif: ${planifs.length} post(s) à générer`)

  for (const planif of planifs) {
    try {
      await traiterPlanification(planif)
    } catch (e) {
      logError(`Instagram planif #${planif.id}: ${e.message}`)
      await updatePlanification(planif.id, { statut: 'erreur', erreur: e.message })
    }
  }
}

async function traiterPlanification(planif) {
  const template = planif.template
  logAction(`Instagram planif #${planif.id}: génération pour "${planif.sujet}"`)

  await updatePlanification(planif.id, { statut: 'en_cours' })

  // 1. Collecter les champs texte du template avec leurs instructions
  const slides = JSON.parse(template.vignettes ?? '[]')
  const champsParSlide = slides.map((s, si) => {
    const textEls = (s.elements ?? []).filter(e => e.type === 'text' && e.iaEnabled !== false)
    return { si, champs: textEls.map(el => ({ nom: el.nom ?? `champ_${el.id}`, instruction: el.iaInstruction ?? '' }) ) }
  }).filter(s => s.champs.length > 0)

  const legendeInstruction = template.legendeInstruction
    || 'Légende Instagram avec emojis, call-to-action et hashtags pertinents'

  // 2. Générer le texte via Mistral pour chaque slide
  let legendeGeneree = ''
  const textesParSlide = []

  for (let i = 0; i < champsParSlide.length; i++) {
    const { si, champs } = champsParSlide[i]
    const inclureLegende = i === 0

    const promptRecord = await prisma.prompt.findUnique({
      where: { module_role: { module: 'instagram', role: 'texte_image' } }
    })
    const systemPrompt = promptRecord?.contenu ?? 'Tu es expert en communication pour une maison d\'édition.'
    const jsonExemple  = '{' + champs.map(c => `"${c.nom}":"..."`).join(',') + ',"legende":"..."}'

    const userPrompt = `${systemPrompt}

Sujet : ${planif.sujet}

${champs.map(c => `Champ "${c.nom}" : ${c.instruction || 'texte libre adapté au sujet'}`).join('\n')}
Champ "legende" : ${inclureLegende ? legendeInstruction : 'ne pas générer, retourne legende: ""'}

Réponds UNIQUEMENT avec le JSON :
${jsonExemple}`

    const model = process.env.MISTRAL_FLASH_MODEL || 'mistral-small-latest'
    const raw   = await callAI('mistral', model, [{ role: 'user', content: userPrompt }])
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Réponse Mistral invalide')

    const parsed  = JSON.parse(match[0])
    if (inclureLegende) legendeGeneree = parsed.legende ?? ''
    textesParSlide.push({ si, champs: Object.fromEntries(Object.entries(parsed).filter(([k]) => k !== 'legende')) })
  }

  // 3. Créer un IgPost avec les textes injectés dans le template
  const slidesRemplies = slides.map((s, si) => {
    const entry = textesParSlide.find(e => e.si === si)
    if (!entry) return s
    return {
      ...s,
      elements: s.elements.map(el => {
        if (el.type !== 'text') return el
        const texte = entry.champs[el.nom ?? `champ_${el.id}`]
        return texte ? { ...el, text: texte } : el
      })
    }
  })

  const postGenere = await prisma.igPost.create({
    data: {
      titre:   `[Auto] ${planif.sujet.slice(0, 60)}`,
      format:  template.format,
      vignettes: JSON.stringify(slidesRemplies),
      legende: legendeGeneree,
      sujet:   planif.sujet,
      statut:  'brouillon',
      estTemplate: false,
    }
  })

  // 4. Rendre la vignette en PNG
  const pngPath = await renderPostToPng(postGenere)

  // 5. Envoyer sur Discord pour validation
  await envoyerValidationDiscord({ planif, postId: postGenere.id, pngPath, legende: legendeGeneree })

  // 6. Mettre à jour la planification
  await updatePlanification(planif.id, {
    statut:      'propose',
    postGenereId: postGenere.id,
    vignettePng:  pngPath,
    legende:      legendeGeneree,
  })

  logAction(`Instagram planif #${planif.id}: proposé sur Discord (post #${postGenere.id})`)
}
