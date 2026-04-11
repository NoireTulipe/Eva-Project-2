/**
 * instagram-poll.cron.js — Polling horaire des commentaires et DMs Instagram
 *
 * Activé par le paramètre DB : instagram.poll.enabled = 'true'
 * Intervalle configurable : instagram.poll.interval_minutes (défaut: 60)
 */

import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'
import { traiterCommentaire, traiterMessage } from '../modules/instagram/instagram.meta.js'
import {
  fetchNouveauxCommentaires,
  fetchNouveauxDMs,
} from '../modules/instagram/instagram.igrapi.js'

let _cronHandle = null

export async function startInstagramPoll() {
  const param = await prisma.configParam.findUnique({ where: { cle: 'instagram.poll.enabled' } })
  if (param?.valeur !== 'true') {
    logAction('Instagram poll: désactivé (instagram.poll.enabled != true)')
    return
  }

  const intervalParam = await prisma.configParam.findUnique({ where: { cle: 'instagram.poll.interval_minutes' } })
  const minutes = Math.max(15, parseInt(intervalParam?.valeur ?? '60')) // minimum 15 min
  const ms      = minutes * 60 * 1000

  logAction(`Instagram poll: démarré — intervalle ${minutes} min`)

  // Premier run immédiat au démarrage
  await runPoll()

  _cronHandle = setInterval(runPoll, ms)
}

export function stopInstagramPoll() {
  if (_cronHandle) { clearInterval(_cronHandle); _cronHandle = null }
  logAction('Instagram poll: arrêté')
}

async function runPoll() {
  logAction('Instagram poll: début du cycle')

  const autoParam = await prisma.configParam.findUnique({ where: { cle: 'instagram.auto_reply' } })
  const autoReply = autoParam?.valeur === 'true'

  let nbCommentaires = 0
  let nbDMs = 0

  // ── Commentaires ──────────────────────────────────────────────────────────
  try {
    const commentaires = await fetchNouveauxCommentaires()
    for (const c of commentaires) {
      await traiterCommentaire({
        igAuteurId:    c.igAuteurId,
        igAuteurNom:   c.igAuteurNom,
        commentaireId: c.commentaireId,
        texte:         c.texte,
        autoReply,
      }).catch(e => logError(`Instagram poll commentaire: ${e.message}`))
    }
    nbCommentaires = commentaires.length
  } catch (e) {
    logError(`Instagram poll: erreur commentaires — ${e.message}`)
  }

  // ── DMs ───────────────────────────────────────────────────────────────────
  try {
    const dms = await fetchNouveauxDMs()
    for (const dm of dms) {
      await traiterMessage({
        igAuteurId:  dm.igAuteurId,
        igAuteurNom: dm.igAuteurNom,
        texte:       dm.texte,
        autoReply,
        threadId:    dm.threadId,  // passé pour la réponse via private API si besoin
      }).catch(e => logError(`Instagram poll DM: ${e.message}`))
    }
    nbDMs = dms.length
  } catch (e) {
    logError(`Instagram poll: erreur DMs — ${e.message}`)
  }

  if (nbCommentaires > 0 || nbDMs > 0) {
    logAction(`Instagram poll: ${nbCommentaires} commentaire(s), ${nbDMs} DM(s) traité(s)`)
  } else {
    logAction('Instagram poll: rien de nouveau')
  }

  // Mettre à jour l'horodatage du dernier poll
  await prisma.configParam.upsert({
    where:  { cle: 'instagram.poll.last_run' },
    create: { cle: 'instagram.poll.last_run', valeur: new Date().toISOString(), description: 'Dernier polling Instagram' },
    update: { valeur: new Date().toISOString() },
  })
}
