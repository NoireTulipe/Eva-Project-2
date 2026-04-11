/**
 * instagram.igrapi.js — Client Node.js pour le microservice Python instagrapi
 *
 * Remplace instagram.private.js avec la même interface exportée.
 * Le microservice Python tourne sur IG_SERVICE_URL (défaut: http://localhost:3001).
 *
 * Toutes les fonctions levant une erreur si le service n'est pas joignable.
 */

import prisma from '../../config/db.js'
import { logAction, logError } from '../../logs/logger.js'

const IG_SERVICE_URL = process.env.IG_SERVICE_URL ?? 'http://localhost:3001'

// ── Client HTTP ───────────────────────────────────────────────────────────────

async function call(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)

  let res
  try {
    res = await fetch(`${IG_SERVICE_URL}${path}`, opts)
  } catch (e) {
    throw new Error(`ig-service injoignable (${IG_SERVICE_URL}) — vérifie que le microservice Python tourne : ${e.message}`)
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? data.error ?? `Erreur ${res.status}`)
  return data
}

// ── Statut (compatibilité avec les routes qui appellent isCheckpointPending/isLoggedIn) ──

let _cachedStatus = { loggedIn: false, checkpointPending: false, username: null }

export async function refreshStatus() {
  try {
    _cachedStatus = await call('GET', '/status')
  } catch {}
  return _cachedStatus
}

export function isCheckpointPending() { return _cachedStatus.checkpointPending }
export function isLoggedIn()          { return _cachedStatus.loggedIn }

// ── Connexion ─────────────────────────────────────────────────────────────────

export async function login() {
  const result = await call('POST', '/login')
  _cachedStatus = { loggedIn: result.loggedIn, checkpointPending: result.checkpointPending, username: result.username }
  return result
}

export async function forceLogin() {
  const result = await call('POST', '/force-login')
  _cachedStatus = { loggedIn: result.loggedIn, checkpointPending: result.checkpointPending, username: result.username }
  if (result.username) {
    await prisma.configParam.upsert({
      where:  { cle: 'instagram.poll.username' },
      create: { cle: 'instagram.poll.username', valeur: result.username, description: 'Compte Instagram écouté' },
      update: { valeur: result.username },
    })
  }
  return result
}

export async function testConnection() {
  const profile = await call('GET', '/profile')
  _cachedStatus.loggedIn          = true
  _cachedStatus.checkpointPending = false
  _cachedStatus.username          = profile.username
  return profile
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

export async function submitCheckpointCode(code) {
  const result = await call('POST', '/challenge/submit', { code })
  _cachedStatus.checkpointPending = false
  _cachedStatus.loggedIn          = true
  logAction('Instagram igrapi: checkpoint validé')
  return result
}

export async function resendCheckpointCode(method = 'email') {
  return call('POST', '/challenge/resend', { method })
}

// ── Polling commentaires ──────────────────────────────────────────────────────

export async function fetchNouveauxCommentaires() {
  const lastRow = await prisma.configParam.findUnique({ where: { cle: 'instagram.poll.last_comment_ts' } })
  const lastTs  = parseInt(lastRow?.valeur ?? '0')

  const { commentaires, maxTs } = await call('GET', `/comments?since_ts=${lastTs}`)

  if (maxTs > lastTs) {
    await prisma.configParam.upsert({
      where:  { cle: 'instagram.poll.last_comment_ts' },
      create: { cle: 'instagram.poll.last_comment_ts', valeur: String(maxTs), description: 'Dernier commentaire traité (timestamp)' },
      update: { valeur: String(maxTs) },
    })
  }

  return commentaires  // même format qu'instagram.private.js
}

// ── Polling DMs ───────────────────────────────────────────────────────────────

export async function fetchNouveauxDMs() {
  const lastRow = await prisma.configParam.findUnique({ where: { cle: 'instagram.poll.last_dm_ts' } })
  const lastTs  = parseInt(lastRow?.valeur ?? '0')

  const { dms, maxTs } = await call('GET', `/dms?since_ts=${lastTs}`)

  if (maxTs > lastTs) {
    await prisma.configParam.upsert({
      where:  { cle: 'instagram.poll.last_dm_ts' },
      create: { cle: 'instagram.poll.last_dm_ts', valeur: String(maxTs), description: 'Dernier DM traité (timestamp)' },
      update: { valeur: String(maxTs) },
    })
  }

  return dms  // même format qu'instagram.private.js
}

// ── Lecture DMs récents ───────────────────────────────────────────────────────

export async function listRecentDMs(limit = 20) {
  return call('GET', `/dms/list?limit=${limit}`)
}

// ── Réponses (compatibilité instagram.meta.js qui peut déléguer ici) ──────────

export async function repondreCommentairePrivate(mediaId, commentaireId, texte) {
  return call('POST', '/comments/reply', { media_id: mediaId, comment_id: commentaireId, text: texte })
}

export async function repondreDMPrivate(threadId, texte) {
  return call('POST', '/dms/reply', { thread_id: threadId, text: texte })
}
