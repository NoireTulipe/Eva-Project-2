import prisma from '../../config/db.js'
import { embed, deserializeVector, cosineSimilarity } from './embeddings.js'

const SEUIL = 0.45  // Similarité minimale pour qu'un résultat soit pertinent
const MAX_RESULTS = 5

/**
 * Recherche sémantique dans la mémoire long terme d'un utilisateur.
 * Interroge MemSouvenir, MemPreference et MemContact.
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

  for (const s of souvenirs) {
    if (!s.embedding) continue
    const score = cosineSimilarity(queryVec, deserializeVector(s.embedding))
    if (score >= SEUIL) resultats.push({ type: 'souvenir', contenu: s.contenu, score })
  }

  for (const p of preferences) {
    if (!p.embedding) continue
    const score = cosineSimilarity(queryVec, deserializeVector(p.embedding))
    if (score >= SEUIL) resultats.push({ type: 'preference', cle: p.cle, contenu: p.contenu, score })
  }

  for (const c of contacts) {
    if (!c.embedding) continue
    const score = cosineSimilarity(queryVec, deserializeVector(c.embedding))
    if (score >= SEUIL) resultats.push({ type: 'contact', nom: c.nom, contenu: c.contenu, score })
  }

  return resultats
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
}

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
