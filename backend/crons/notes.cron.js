/**
 * notes.cron.js — Rappels et expiration automatique des notes
 *
 * - Supprime les notes dont expirationAt est dépassé
 * - Envoie une notification Discord pour les rappels arrivés à échéance
 * - Préparé pour notifications Android (hook appelable depuis l'extérieur)
 */

import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'

// Client Discord injecté depuis bot.js via setNotesDiscordClient()
let _discordClient = null
export function setNotesDiscordClient(client) { _discordClient = client }

export async function traiterNotes() {
  const now = new Date()

  // ── 1. Supprimer les notes expirées ──────────────────────────────────────────
  try {
    const { count } = await prisma.note.deleteMany({
      where: { expirationAt: { lte: now } }
    })
    if (count > 0) logAction(`Notes : ${count} note(s) expirée(s) supprimée(s)`)
  } catch (err) {
    logError(`Notes cron (expiration) : ${err.message}`)
  }

  // ── 2. Envoyer les rappels arrivés à échéance ────────────────────────────────
  try {
    const aRappeler = await prisma.note.findMany({
      where: {
        rappelAt: { lte: now },
        rappelEnvoye: false
      }
    })

    for (const note of aRappeler) {
      await envoyerRappel(note)
      await prisma.note.update({
        where: { id: note.id },
        data: { rappelEnvoye: true }
      })
    }

    if (aRappeler.length > 0) {
      logAction(`Notes : ${aRappeler.length} rappel(s) envoyé(s)`)
    }
  } catch (err) {
    logError(`Notes cron (rappels) : ${err.message}`)
  }
}

async function envoyerRappel(note) {
  // ── Discord ──────────────────────────────────────────────────────────────────
  try {
    const param = await prisma.configParam.findUnique({
      where: { cle: 'notes.discord.channel_id' }
    })

    if (param?.valeur && _discordClient?.isReady()) {
      const channel = await _discordClient.channels.fetch(param.valeur)
      if (channel) {
        const extrait = note.contenu.length > 200
          ? note.contenu.slice(0, 200) + '…'
          : note.contenu
        await channel.send(`📌 **Rappel de note**\n\n${extrait}`)
      }
    }
  } catch (err) {
    logError(`Notes rappel Discord (note #${note.id}) : ${err.message}`)
  }

  // ── Android push — préparé, à brancher quand le module push sera actif ───────
  // await envoyerPushAndroid({ titre: 'Rappel', corps: note.contenu })
}
