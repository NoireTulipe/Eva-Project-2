import { pipeline } from '@xenova/transformers'
import { logAction, logError } from '../../logs/logger.js'

// Modèle léger multilingue — bon pour le français
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'

let extractor = null

async function getExtractor() {
  if (!extractor) {
    logAction('Embeddings : chargement du modèle (premier démarrage, peut prendre 1-2 min)…')
    extractor = await pipeline('feature-extraction', MODEL, { revision: 'main' })
    logAction('Embeddings : modèle chargé')
  }
  return extractor
}

/**
 * Génère un vecteur embedding pour un texte.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  const fn = await getExtractor()
  const output = await fn(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}

/**
 * Sérialise un vecteur pour stockage SQLite.
 * @param {number[]} vec
 * @returns {string}
 */
export function serializeVector(vec) {
  return JSON.stringify(vec)
}

/**
 * Désérialise un vecteur depuis SQLite.
 * @param {string} str
 * @returns {number[]}
 */
export function deserializeVector(str) {
  try { return JSON.parse(str) } catch { return [] }
}

/**
 * Similarité cosinus entre deux vecteurs.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Entre 0 et 1
 */
export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
