import prisma from '../../config/db.js'
import { callAI } from '../../llm/providers.js'
import { embed, serializeVector } from './embeddings.js'
import { logAction, logError } from '../../logs/logger.js'

const PROMPT_CONSOLIDATION = `Tu es un système d'extraction de mémoire. Analyse ces échanges et extrais les informations importantes sur l'utilisateur.

RÈGLE ABSOLUE : Réponds UNIQUEMENT en JSON valide, rien d'autre.

Format de réponse :
{
  "souvenirs": ["fait important sur l'utilisateur ou un événement notable"],
  "preferences": [{"cle": "clé_courte", "contenu": "description de la préférence"}],
  "contacts": [{"nom": "Prénom Nom", "contenu": "ce qu'on sait de cette personne"}]
}

Si rien de mémorisable → {"souvenirs": [], "preferences": [], "contacts": []}

N'extrais que ce qui est réellement significatif. Ignore les questions banales et les réponses génériques.`

/**
 * Consolide le MemBuffer non traité d'un utilisateur vers la mémoire long terme.
 * @param {number} userId
 * @param {string} provider
 * @param {string} model
 */
export async function consolidateUser(userId, provider, model) {
  const entries = await prisma.memBuffer.findMany({
    where: {
      source: { contains: String(userId) },
      traite: false
    },
    orderBy: { createdAt: 'asc' },
    take: 50
  })

  if (entries.length === 0) return { userId, traites: 0 }

  const texte = entries.map(e => e.contenu).join('\n---\n')

  let extraction
  try {
    const raw = await callAI(provider, model, [
      { role: 'user', content: `${PROMPT_CONSOLIDATION}\n\nÉCHANGES :\n${texte}` }
    ])

    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    }
    extraction = JSON.parse(cleaned)
  } catch (err) {
    logError(`Consolidation userId=${userId}: ${err.message}`)
    return { userId, traites: 0, erreur: err.message }
  }

  // Sauvegarder avec embeddings
  const ops = []

  for (const contenu of (extraction.souvenirs || [])) {
    if (!contenu?.trim()) continue
    const embedding = serializeVector(await embed(contenu))
    ops.push(prisma.memSouvenir.create({ data: { userId, contenu, embedding } }))
  }

  for (const { cle, contenu } of (extraction.preferences || [])) {
    if (!cle?.trim() || !contenu?.trim()) continue
    const embedding = serializeVector(await embed(contenu))
    ops.push(prisma.memPreference.upsert({
      where: { id: 0 }, // force create via catch
      update: { contenu, embedding },
      create: { userId, cle, contenu, embedding }
    }).catch(() => prisma.memPreference.create({ data: { userId, cle, contenu, embedding } })))
  }

  for (const { nom, contenu } of (extraction.contacts || [])) {
    if (!nom?.trim() || !contenu?.trim()) continue
    const embedding = serializeVector(await embed(contenu))
    ops.push(prisma.memContact.create({ data: { userId, nom, contenu, embedding } }))
  }

  await Promise.allSettled(ops)

  // Marquer le buffer comme traité
  await prisma.memBuffer.updateMany({
    where: { id: { in: entries.map(e => e.id) } },
    data: { traite: true }
  })

  const nbSouvenirs = (extraction.souvenirs || []).length
  const nbPrefs = (extraction.preferences || []).length
  const nbContacts = (extraction.contacts || []).length

  logAction(`Consolidation userId=${userId} : ${entries.length} entrées → ${nbSouvenirs} souvenirs, ${nbPrefs} prefs, ${nbContacts} contacts`)
  return { userId, traites: entries.length, nbSouvenirs, nbPrefs, nbContacts }
}

/**
 * Consolide tous les utilisateurs ayant du buffer non traité.
 */
export async function consolidateAll() {
  const config = await getLLMConfig()

  // Trouver les userId distincts avec buffer non traité
  const buffers = await prisma.memBuffer.findMany({
    where: { traite: false },
    select: { source: true },
    distinct: ['source']
  })

  // Extraire les userId depuis "web:123" ou "discord:123"
  const userIds = [...new Set(
    buffers
      .map(b => b.source.split(':')[1])
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n))
  )]

  if (userIds.length === 0) {
    logAction('Consolidation : aucun buffer à traiter')
    return
  }

  logAction(`Consolidation : ${userIds.length} utilisateur(s) à traiter`)

  for (const userId of userIds) {
    await consolidateUser(userId, config.provider, config.flashModel)
  }
}

async function getLLMConfig() {
  const params = await prisma.configParam.findMany({
    where: { cle: { in: ['llm.provider', 'llm.flash_model'] } }
  })
  const map = Object.fromEntries(params.map(p => [p.cle, p.valeur]))
  return {
    provider: map['llm.provider'] || 'gemini',
    flashModel: map['llm.flash_model'] || 'gemini-2.5-flash'
  }
}
