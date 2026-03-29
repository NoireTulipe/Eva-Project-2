import prisma from '../config/db.js'

/**
 * Retourne la configuration d'un canal Discord.
 * Si le canal n'est pas configuré → mode "conversation" par défaut.
 * @param {string} channelId
 * @returns {Promise<{mode: string, categories: string[]}>}
 */
export async function getCanalConfig(channelId) {
  if (!channelId) return { mode: 'conversation', categories: [] }

  const canal = await prisma.canalDiscord.findUnique({
    where: { channelId }
  })

  if (!canal || !canal.actif) {
    return { mode: 'conversation', categories: [] }
  }

  let categories = []
  try {
    categories = JSON.parse(canal.categories)
  } catch {
    categories = []
  }

  return { mode: canal.mode, categories }
}
