import prisma from '../../config/db.js'
import { callAI } from '../../llm/providers.js'
import { getPrompt, resolvePromptTags, PROMPTS_DEFAUT } from '../../llm/prompts.js'
import { embed, serializeVector, deserializeVector, cosineSimilarity } from './embeddings.js'
import { logAction, logError } from '../../logs/logger.js'

// Seuil de similarité pour considérer deux souvenirs comme doublons
const SEUIL_DOUBLON_SOUVENIR = 0.88

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
    const promptTemplate = await getPrompt('consolidation', 'system') || PROMPTS_DEFAUT.consolidation.system
    const prompt = resolvePromptTags(promptTemplate, { ECHANGES: texte })

    const raw = await callAI(provider, model, [
      { role: 'user', content: prompt }
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

  const ops = []
  let nbSouvenirs = 0, nbPrefs = 0, nbContacts = 0

  // ─── SOUVENIRS : déduplication sémantique ────────────────────────────────────
  const existantsSouvenirs = await prisma.memSouvenir.findMany({
    where: { userId },
    select: { id: true, contenu: true, embedding: true }
  })

  for (const contenu of (extraction.souvenirs || [])) {
    if (!contenu?.trim()) continue
    const vec = await embed(contenu)

    // Chercher un souvenir existant très similaire
    let doublon = null
    for (const s of existantsSouvenirs) {
      if (!s.embedding) continue
      const score = cosineSimilarity(vec, deserializeVector(s.embedding))
      if (score >= SEUIL_DOUBLON_SOUVENIR) {
        doublon = s
        break
      }
    }

    if (doublon) {
      // Mettre à jour avec la formulation la plus récente
      const embedding = serializeVector(vec)
      ops.push(prisma.memSouvenir.update({
        where: { id: doublon.id },
        data: { contenu: contenu.trim(), embedding }
      }))
      logAction(`Consolidation: souvenir mis à jour (id=${doublon.id})`)
    } else {
      const embedding = serializeVector(vec)
      ops.push(prisma.memSouvenir.create({
        data: { userId, contenu: contenu.trim(), embedding }
      }))
      nbSouvenirs++
    }
  }

  // ─── PRÉFÉRENCES : upsert par clé ────────────────────────────────────────────
  for (const { cle, contenu } of (extraction.preferences || [])) {
    if (!cle?.trim() || !contenu?.trim()) continue
    const embedding = serializeVector(await embed(contenu))

    ops.push(
      prisma.memPreference.upsert({
        where: { userId_cle: { userId, cle: cle.trim() } },
        update: { contenu: contenu.trim(), embedding },
        create: { userId, cle: cle.trim(), contenu: contenu.trim(), embedding }
      })
    )
    nbPrefs++
  }

  // ─── CONTACTS : upsert par nom + liaison des relations extraites ─────────────
  const existantsContacts = await prisma.memContact.findMany({
    where: { userId },
    select: { id: true, nom: true, contenu: true }
  })

  for (const contactData of (extraction.contacts || [])) {
    const { nom, contenu, relations: relationsExtraites } = typeof contactData === 'string'
      ? { nom: contactData, contenu: contactData, relations: [] }
      : contactData

    if (!nom?.trim() || !contenu?.trim()) continue
    const embedding = serializeVector(await embed(contenu))

    // Recherche par nom insensible à la casse
    const nomNormalisé = nom.trim().toLowerCase()
    const existant = existantsContacts.find(c =>
      c.nom.toLowerCase() === nomNormalisé ||
      c.nom.toLowerCase().includes(nomNormalisé) ||
      nomNormalisé.includes(c.nom.toLowerCase())
    )

    let contactId
    if (existant) {
      const contenuFusionné = fusionnerContenu(existant.contenu, contenu.trim())
      await prisma.memContact.update({
        where: { id: existant.id },
        data: {
          nom: nom.trim(),
          contenu: contenuFusionné,
          embedding: serializeVector(await embed(contenuFusionné))
        }
      })
      contactId = existant.id
      logAction(`Consolidation: contact fusionné "${nom}"`)
    } else {
      const created = await prisma.memContact.create({
        data: { userId, nom: nom.trim(), contenu: contenu.trim(), embedding }
      })
      contactId = created.id
      nbContacts++
    }

    // Lier les relations extraites (find-or-create par nom, insensible à la casse)
    if (Array.isArray(relationsExtraites) && relationsExtraites.length > 0) {
      for (const nomRel of relationsExtraites) {
        if (!nomRel?.trim()) continue
        try {
          // Upsert la relation (unique par userId + nom)
          const relation = await prisma.memRelation.upsert({
            where: { userId_nom: { userId, nom: nomRel.trim() } },
            update: {},
            create: { userId, nom: nomRel.trim() }
          })
          // Lier au contact (ignorer si déjà lié)
          await prisma.memContact.update({
            where: { id: contactId },
            data: { relations: { connect: { id: relation.id } } }
          })
        } catch {
          // Doublon de liaison — ignoré silencieusement
        }
      }
    }
  }

  await Promise.allSettled(ops)

  // Marquer le buffer comme traité
  await prisma.memBuffer.updateMany({
    where: { id: { in: entries.map(e => e.id) } },
    data: { traite: true }
  })

  logAction(`Consolidation userId=${userId} : ${entries.length} entrées → ${nbSouvenirs} souvenirs, ${nbPrefs} prefs, ${nbContacts} contacts`)
  return { userId, traites: entries.length, nbSouvenirs, nbPrefs, nbContacts }
}

/**
 * Fusionne deux contenus en évitant les répétitions évidentes.
 * Ajoute le nouveau contenu seulement si sa substance n'est pas déjà présente.
 */
function fusionnerContenu(existant, nouveau) {
  // Si le nouveau est déjà contenu dans l'existant, on garde l'existant
  if (existant.toLowerCase().includes(nouveau.toLowerCase())) return existant
  // Si l'existant est contenu dans le nouveau, le nouveau est plus complet
  if (nouveau.toLowerCase().includes(existant.toLowerCase())) return nouveau
  // Sinon, on concatène
  return `${existant} | ${nouveau}`
}

/**
 * Consolide tous les utilisateurs ayant du buffer non traité.
 */
export async function consolidateAll() {
  const config = await getLLMConfig()

  const buffers = await prisma.memBuffer.findMany({
    where: { traite: false },
    select: { source: true },
    distinct: ['source']
  })

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
