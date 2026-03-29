import prisma from '../config/db.js'

const cache = new Map()

/**
 * Charge un prompt depuis la table Prompt (avec cache en mémoire).
 * @param {string} module - ex: 'orchestrateur', 'redacteur'
 * @param {string} role   - ex: 'system'
 * @returns {Promise<string|null>}
 */
export async function getPrompt(module, role) {
  const key = `${module}:${role}`
  if (cache.has(key)) return cache.get(key)

  const p = await prisma.prompt.findUnique({
    where: { module_role: { module, role } }
  })

  if (p?.actif) {
    cache.set(key, p.contenu)
    return p.contenu
  }

  return null
}

/** Vide le cache (à appeler après modification d'un prompt en admin). */
export function invalidatePromptCache() {
  cache.clear()
}
