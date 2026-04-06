import prisma from '../../config/db.js'
import { embed, deserializeVector, cosineSimilarity } from './embeddings.js'

const SEUIL = 0.35        // Similarité minimale pour la recherche sémantique
const MAX_RESULTS = 8     // Résultats max retournés au total

// ─── ENRICHISSEMENT ───────────────────────────────────────────────────────────

/**
 * Charge les relations et souvenirs liés pour une liste de contacts.
 * Retourne un Map id → { relations, souvenirs }
 */
async function enrichirContacts(contactIds) {
  if (contactIds.length === 0) return new Map()
  const contacts = await prisma.memContact.findMany({
    where: { id: { in: contactIds } },
    select: {
      id: true,
      relations: { select: { id: true, nom: true, description: true } },
      souvenirs: { select: { id: true, contenu: true } }
    }
  })
  return new Map(contacts.map(c => [c.id, { relations: c.relations, souvenirs: c.souvenirs }]))
}

// ─── RECHERCHE SÉMANTIQUE ─────────────────────────────────────────────────────

/**
 * Recherche sémantique dans la mémoire long terme d'un utilisateur.
 * Interroge MemSouvenir, MemPreference et MemContact.
 * Les contacts trouvés sont enrichis avec leurs relations et souvenirs liés.
 * @param {string} query
 * @param {number} userId
 * @returns {Promise<Array>}
 */
export async function rechercheMemoire(query, userId) {
  const queryVec = await embed(query)

  const [souvenirs, preferences, contacts] = await Promise.all([
    prisma.memSouvenir.findMany({ where: { userId } }),
    prisma.memPreference.findMany({ where: { userId } }),
    prisma.memContact.findMany({ where: { userId } })
  ])

  const resultats = []
  const contactIds = []

  for (const s of souvenirs) {
    if (!s.embedding) continue
    const score = cosineSimilarity(queryVec, deserializeVector(s.embedding))
    if (score >= SEUIL) resultats.push({ type: 'souvenir', id: s.id, contenu: s.contenu, score })
  }

  for (const p of preferences) {
    if (!p.embedding) continue
    const score = cosineSimilarity(queryVec, deserializeVector(p.embedding))
    if (score >= SEUIL) resultats.push({ type: 'preference', id: p.id, cle: p.cle, contenu: p.contenu, score })
  }

  for (const c of contacts) {
    if (!c.embedding) continue
    const score = cosineSimilarity(queryVec, deserializeVector(c.embedding))
    if (score >= SEUIL) {
      resultats.push({ type: 'contact', id: c.id, nom: c.nom, contenu: c.contenu, score })
      contactIds.push(c.id)
    }
  }

  // Enrichir les contacts trouvés avec leurs relations + souvenirs liés
  if (contactIds.length > 0) {
    const enrichMap = await enrichirContacts(contactIds)
    for (const r of resultats) {
      if (r.type === 'contact' && enrichMap.has(r.id)) {
        const extra = enrichMap.get(r.id)
        r.relations = extra.relations
        r.souvenirs = extra.souvenirs
      }
    }
  }

  return resultats
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
}

// ─── RECHERCHE PAR NOM (Eva v1 pattern) ──────────────────────────────────────

/**
 * Extrait les candidats noms propres d'un message.
 * Heuristique : mots capitalisés de 3+ caractères, hors début de phrase.
 */
function extraireNomsCandidat(message) {
  // Découpe en mots, retient ceux qui commencent par une majuscule
  // et qui ne sont pas en début absolu de phrase (pour éviter "Je", "Le", etc.)
  const mots = message.split(/\s+/)
  const candidats = new Set()

  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i].replace(/[.,!?;:«»"'()\[\]]/g, '')
    if (
      mot.length >= 3 &&
      /^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/.test(mot) &&
      i > 0  // pas le premier mot de la phrase (souvent "Je", "Tu", etc.)
    ) {
      candidats.add(mot.toLowerCase())
    }
  }
  return [...candidats]
}

/**
 * Recherche des contacts par nom dans le message (pattern Eva v1).
 * Extrait les noms propres candidats, cherche en texte dans MemContact.nom.
 * Retourne les contacts enrichis trouvés.
 * @param {string} message
 * @param {number} userId
 * @returns {Promise<Array>}
 */
export async function rechercheContactParNom(message, userId) {
  const candidats = extraireNomsCandidat(message)
  if (candidats.length === 0) return []

  // Chercher tous les contacts dont le nom contient l'un des candidats
  const contacts = await prisma.memContact.findMany({ where: { userId } })

  const trouves = []
  for (const c of contacts) {
    const nomLower = c.nom.toLowerCase()
    const correspond = candidats.some(cand =>
      nomLower.includes(cand) || cand.includes(nomLower.split(' ')[0])
    )
    if (correspond) {
      trouves.push({ type: 'contact', id: c.id, nom: c.nom, contenu: c.contenu, score: 0.9, sourceNom: true })
    }
  }

  // Enrichir
  if (trouves.length > 0) {
    const enrichMap = await enrichirContacts(trouves.map(c => c.id))
    for (const r of trouves) {
      const extra = enrichMap.get(r.id)
      if (extra) { r.relations = extra.relations; r.souvenirs = extra.souvenirs }
    }
  }

  return trouves
}

// ─── RECHERCHE PAR RELATION ───────────────────────────────────────────────────

/**
 * Détecte si le message mentionne une relation connue de l'utilisateur.
 * Si oui, retourne tous les contacts liés à cette relation — enrichis.
 * Ex : "parle-moi de ma famille" → trouve relation "famille" → retourne ses contacts.
 * @param {string} message
 * @param {number} userId
 * @returns {Promise<Array>}
 */
export async function rechercheContactsParRelation(message, userId) {
  const messageLower = message.toLowerCase()

  // Charger toutes les relations de l'utilisateur
  const relations = await prisma.memRelation.findMany({
    where: { userId },
    select: { id: true, nom: true, description: true }
  })

  if (relations.length === 0) return []

  // Trouver quelles relations sont mentionnées dans le message
  const relationsDetectees = relations.filter(r => messageLower.includes(r.nom.toLowerCase()))
  if (relationsDetectees.length === 0) return []

  // Récupérer les contacts liés à ces relations (enrichis)
  const contacts = await prisma.memContact.findMany({
    where: {
      userId,
      relations: { some: { id: { in: relationsDetectees.map(r => r.id) } } }
    },
    select: {
      id: true, nom: true, contenu: true,
      relations: { select: { id: true, nom: true, description: true } },
      souvenirs: { select: { id: true, contenu: true } }
    }
  })

  return contacts.map(c => ({
    type: 'contact',
    id: c.id,
    nom: c.nom,
    contenu: c.contenu,
    relations: c.relations,
    souvenirs: c.souvenirs,
    score: 1.0,
    sourceRelation: relationsDetectees.map(r => r.nom)
  }))
}

// ─── RECHERCHE DANS LE BUFFER ─────────────────────────────────────────────────

/**
 * Recherche dans le buffer non consolidé (texte simple).
 * @param {string} query
 * @param {number} userId
 * @param {string} sourcePrefix - 'web' | 'discord'
 */
export async function rechercheBuffer(query, userId, sourcePrefix = null) {
  const where = {
    traite: false,
    contenu: { contains: query }
  }
  if (sourcePrefix) {
    where.source = { startsWith: `${sourcePrefix}:${userId}` }
  } else {
    where.source = { contains: String(userId) }
  }

  return prisma.memBuffer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { contenu: true, source: true, createdAt: true }
  })
}
