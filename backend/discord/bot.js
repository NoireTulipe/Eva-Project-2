import { Client, GatewayIntentBits } from 'discord.js'
import { processMessage, processConversation } from '../llm/orchestrateur.js'
import { getCanalConfig } from './canal.service.js'
import { logAction, logError } from '../logs/logger.js'
import prisma from '../config/db.js'

const DISCORD_LIMIT = 2000

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
})

client.once('ready', () => {
  logAction(`Discord : bot connecté en tant que ${client.user.tag}`)
})

client.on('messageCreate', async (message) => {
  // Ignorer les bots
  if (message.author.bot) return

  const isDM = !message.guild
  const userMessage = message.content.replace(/<@!?\d+>/g, '').trim()

  if (!userMessage) return

  const channelId = message.channel.id

  try {
    await message.channel.sendTyping()

    // Configuration du canal
    const canalConfig = await getCanalConfig(isDM ? null : channelId)

    // Canal exclu → EVA n'écoute pas
    if (canalConfig.mode === 'exclu') return

    // Historique récent du canal (5 derniers messages)
    const history = await fetchHistory(message.channel, client.user.id, 6)
    // Exclure le message courant (dernier)
    const historyWithoutCurrent = history.slice(0, -1)

    // Résoudre l'ID DB depuis l'ID Discord
    const dbUserId = await resolveDbUserId(message.author.id)

    const context = {
      userId: dbUserId,
      userName: message.author.displayName || message.author.username,
      history: historyWithoutCurrent
    }

    let response

    if (canalConfig.mode === 'conversation' || canalConfig.categories.length === 0) {
      // Mode conversation : Pro direct + mémoire, aucun outil
      response = await processConversation(userMessage, context)
    } else {
      // Mode outils : pipeline complet filtré sur les catégories du canal
      response = await processMessage(userMessage, context, {
        categories: canalConfig.categories
      })
    }

    logAction(`Discord [${channelId}] mode=${canalConfig.mode} → ${response.length} chars`)

    // Discord : limite 2000 caractères
    if (response.length > DISCORD_LIMIT) {
      const chunks = response.match(/[\s\S]{1,1990}/g) || []
      for (let i = 0; i < chunks.length; i++) {
        await message.reply(chunks[i] + (i < chunks.length - 1 ? '…' : ''))
      }
    } else {
      await message.reply(response)
    }

  } catch (err) {
    logError(`Discord messageCreate: ${err.message}`)
    await message.reply('Désolée, j\'ai eu un souci technique. Réessaie dans un instant.')
  }
})

/**
 * Résout l'ID utilisateur DB depuis un ID Discord.
 * Si l'utilisateur Discord n'est pas lié à un compte, retourne l'ID du premier admin.
 * @param {string} discordId
 * @returns {Promise<number>}
 */
async function resolveDbUserId(discordId) {
  // Chercher un utilisateur avec ce discordId
  const user = await prisma.user.findUnique({ where: { discordId } })
  if (user) return user.id

  // Fallback : premier admin actif
  const admin = await prisma.user.findFirst({
    where: { role: 'admin', actif: true },
    orderBy: { id: 'asc' }
  })
  if (admin) {
    logAction(`Discord: discordId ${discordId} non lié — fallback user id=${admin.id}. Liez le compte dans Admin > Utilisateurs.`)
    return admin.id
  }

  return 1
}

async function fetchHistory(channel, botId, count) {
  try {
    const fetched = await channel.messages.fetch({ limit: count })
    return [...fetched.values()]
      .reverse()
      .map(msg => ({
        role: msg.author.id === botId ? 'assistant' : 'user',
        content: msg.content.replace(/<@!?\d+>/g, '').trim()
      }))
      .filter(m => m.content.length > 0)
  } catch {
    return []
  }
}

export async function startBot() {
  const token = process.env.DISCORD_TOKEN
  if (!token) {
    logError('Discord : DISCORD_TOKEN absent du .env — bot non démarré')
    return
  }
  await client.login(token)
}
