/**
 * instagram.discord.js — Envoi des vignettes générées sur Discord pour validation
 *
 * Envoie un message dans le salon configuré (ConfigParam: discord.instagram.channel_id)
 * avec la vignette PNG + légende + boutons ✅ Valider / ✏️ Modifier / ❌ Refuser.
 *
 * Les interactions avec les boutons sont gérées dans bot.js via interactionCreate.
 */

import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { resolve, dirname } from 'path'
import { fileURLToPath }    from 'url'
import { existsSync }       from 'fs'
import prisma               from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const UPLOADS    = resolve(__dirname, '../uploads/instagram')

// Le client Discord est instancié dans bot.js — on l'importe via un getter lazy
let _discordClient = null
export function setDiscordClient(client) { _discordClient = client }

export async function envoyerValidationDiscord({ planif, postId, pngPath, legende }) {
  // Récupérer le channel configuré
  const param = await prisma.configParam.findUnique({ where: { cle: 'discord.instagram.channel_id' } })
  if (!param?.valeur) {
    logAction('Instagram Discord: discord.instagram.channel_id non configuré — envoi ignoré')
    return
  }

  if (!_discordClient?.isReady()) {
    logError('Instagram Discord: bot Discord non connecté — envoi ignoré')
    return
  }

  try {
    const channel = await _discordClient.channels.fetch(param.valeur)
    if (!channel) throw new Error(`Salon Discord introuvable : ${param.valeur}`)

    // Préparer l'image
    const fullPath = resolve(UPLOADS, pngPath)
    const files    = existsSync(fullPath) ? [new AttachmentBuilder(fullPath, { name: 'vignette.png' })] : []

    // Texte du message
    const dateStr = new Date(planif.datePost).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    })
    const content = [
      `📸 **Post prévu pour ${dateStr}**`,
      `📝 Sujet : *${planif.sujet}*`,
      '',
      `**Légende :**`,
      legende || '*(pas de légende générée)*',
      '',
      `Post #${postId} — Ouvre Instafacile pour modifier`,
    ].join('\n').slice(0, 1900) // limite Discord

    // Boutons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ig_valider_${planif.id}_${postId}`)
        .setLabel('✅ Valider & programmer')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ig_modifier_${planif.id}_${postId}`)
        .setLabel('✏️ Ouvrir dans EVA')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ig_refuser_${planif.id}_${postId}`)
        .setLabel('❌ Refuser')
        .setStyle(ButtonStyle.Danger),
    )

    const msg = await channel.send({ content, files, components: [row] })

    // Sauvegarder l'ID du message Discord pour retrouver la planification lors de l'interaction
    await prisma.igPlanification.update({
      where: { id: planif.id },
      data:  { discordMsgId: msg.id },
    })

    logAction(`Instagram Discord: message de validation envoyé (planif #${planif.id}, msg ${msg.id})`)
  } catch (e) {
    logError(`Instagram Discord: erreur envoi — ${e.message}`)
    throw e
  }
}
