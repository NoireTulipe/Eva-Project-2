/**
 * instagram.private.js — Lecture des commentaires et DMs via instagram-private-api
 *
 * Utilisé UNIQUEMENT pour écouter (polling horaire).
 * La publication reste sur l'API Meta officielle.
 *
 * Prérequis .env :
 *   IG_USERNAME   — identifiant Instagram du compte
 *   IG_PASSWORD   — mot de passe Instagram du compte
 *
 * La session est persistée dans backend/data/ig-session.json pour éviter
 * de se reconnecter à chaque polling.
 */

import { IgApiClient, IgCheckpointError } from 'instagram-private-api'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync }  from 'fs'
import prisma          from '../../config/db.js'
import { logAction, logError } from '../../logs/logger.js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = resolve(__dirname, '../../data')
const SESSION_FILE = resolve(DATA_DIR, 'ig-session.json')

const ig = new IgApiClient()
let _loggedIn        = false
let _checkpointPending = false  // true quand Instagram attend un code de vérification

export function isCheckpointPending() { return _checkpointPending }
export function isLoggedIn()          { return _loggedIn }

// ── Soumettre le code de vérification checkpoint ──────────────────────────────

export async function submitCheckpointCode(code) {
  if (!_checkpointPending) throw new Error('Aucun checkpoint en attente')
  try {
    await ig.challenge.sendSecurityCode(code)
    await saveSession()
    _loggedIn         = true
    _checkpointPending = false
    logAction('Instagram private: checkpoint validé, session sauvegardée')
  } catch (e) {
    logError(`Instagram private: code checkpoint invalide — ${e.message}`)
    throw new Error('Code invalide ou expiré')
  }
}

// ── Persistance session ───────────────────────────────────────────────────────

async function saveSession() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  const state = await ig.exportState()
  await writeFile(SESSION_FILE, JSON.stringify(state), 'utf-8')
}

async function loadSession() {
  if (!existsSync(SESSION_FILE)) return false
  try {
    const state = JSON.parse(await readFile(SESSION_FILE, 'utf-8'))
    await ig.importState(state)
    return true
  } catch {
    return false
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login() {
  const username = process.env.IG_USERNAME
  const password = process.env.IG_PASSWORD
  if (!username || !password) throw new Error('IG_USERNAME ou IG_PASSWORD non défini dans .env')

  ig.state.generateDevice(username)

  // Essayer de restaurer la session existante
  const restored = await loadSession()
  if (restored) {
    try {
      // Vérifier que la session est encore valide
      await ig.account.currentUser()
      logAction('Instagram private: session restaurée')
      _loggedIn = true
      return
    } catch (e) {
      if (e.message?.includes('checkpoint') || e instanceof IgCheckpointError) {
        logAction('Instagram private: checkpoint requis après restauration session — envoi du code…')
        _checkpointPending = true
        await ig.challenge.auto(true).catch(() => {})
        logAction('Instagram private: code de vérification envoyé — saisis-le dans EVA → Instagram → Paramètres')
        return
      }
      logAction('Instagram private: session expirée, reconnexion…')
      _loggedIn = false
    }
  }

  // Connexion fraîche
  try {
    await ig.simulate.preLoginFlow()
    await ig.account.login(username, password)
    await ig.simulate.postLoginFlow()
    await saveSession()
    _loggedIn          = true
    _checkpointPending = false
    // Sauvegarder le username connecté en DB pour l'afficher dans l'UI
    await prisma.configParam.upsert({
      where:  { cle: 'instagram.poll.username' },
      create: { cle: 'instagram.poll.username', valeur: username, description: 'Compte Instagram écouté par le polling' },
      update: { valeur: username },
    })
    logAction(`Instagram private: connecté en tant que @${username}`)
  } catch (e) {
    const isCheckpoint = e instanceof IgCheckpointError || e.message?.includes('checkpoint_required') || e.message?.includes('checkpoint')
    if (isCheckpoint) {
      logAction('Instagram private: checkpoint requis — envoi du code de vérification…')
      _checkpointPending = true
      // Demander le code par email (méthode la plus fiable)
      try { await ig.challenge.auto(true) } catch {}
      logAction('Instagram private: code de vérification envoyé — saisis-le dans EVA → Instagram → Paramètres')
      // Ne pas relancer d'erreur — l'état checkpoint est stocké, le polling attendra
      return
    }
    throw e
  }
}

async function ensureLoggedIn() {
  if (_checkpointPending) throw new Error('Checkpoint Instagram en attente — saisis le code dans EVA → Paramètres')
  if (!_loggedIn) await login()
  if (_checkpointPending) throw new Error('Checkpoint Instagram en attente — saisis le code dans EVA → Paramètres')
}

// ── Récupérer les commentaires récents non traités ────────────────────────────

export async function fetchNouveauxCommentaires() {
  await ensureLoggedIn()

  // Récupérer le timestamp du dernier commentaire traité
  const lastRow = await prisma.configParam.findUnique({
    where: { cle: 'instagram.poll.last_comment_ts' }
  })
  const lastTs = parseInt(lastRow?.valeur ?? '0')

  const nouveaux = []

  try {
    // Récupérer les médias récents du compte
    const feed     = ig.feed.user(ig.state.cookieUserId)
    const medias   = await feed.items()
    const recents  = medias.slice(0, 10) // les 10 derniers posts

    let maxTs = lastTs

    for (const media of recents) {
      const commentsFeed = ig.feed.mediaComments(media.id)
      const comments     = await commentsFeed.items()

      for (const c of comments) {
        const ts = c.created_at_utc ?? c.created_at ?? 0
        if (ts <= lastTs) continue
        if (c.user?.pk === ig.state.cookieUserId) continue // ignorer ses propres commentaires

        nouveaux.push({
          commentaireId: String(c.pk),
          mediaId:       String(media.id),
          igAuteurId:    String(c.user?.pk ?? ''),
          igAuteurNom:   c.user?.username ?? null,
          texte:         c.text ?? '',
        })

        if (ts > maxTs) maxTs = ts
      }
    }

    // Mettre à jour le timestamp
    if (maxTs > lastTs) {
      await prisma.configParam.upsert({
        where:  { cle: 'instagram.poll.last_comment_ts' },
        create: { cle: 'instagram.poll.last_comment_ts', valeur: String(maxTs), description: 'Dernier commentaire traité (timestamp)' },
        update: { valeur: String(maxTs) },
      })
    }
  } catch (e) {
    if (e.message?.includes('checkpoint') || e instanceof IgCheckpointError) {
      _loggedIn = false
      _checkpointPending = true
      logError(`Instagram private commentaires: checkpoint requis — ${e.message}`)
    } else if (e.message?.includes('login') || e.message?.includes('401')) {
      _loggedIn = false
      logError(`Instagram private: session invalide — ${e.message}`)
    } else {
      throw e
    }
  }

  return nouveaux
}

// ── Récupérer les DMs non traités ─────────────────────────────────────────────

export async function fetchNouveauxDMs() {
  await ensureLoggedIn()

  const lastRow = await prisma.configParam.findUnique({
    where: { cle: 'instagram.poll.last_dm_ts' }
  })
  const lastTs = parseInt(lastRow?.valeur ?? '0')

  const nouveaux = []

  try {
    const inbox = ig.feed.directInbox()
    const threads = await inbox.items()

    let maxTs = lastTs

    for (const thread of threads.slice(0, 20)) {
      // Dernier message du fil
      const msg = thread.items?.[0]
      if (!msg) continue

      const ts = Math.floor(parseInt(msg.timestamp ?? '0') / 1000) // µs → s
      if (ts <= lastTs) continue
      if (msg.user_id === parseInt(ig.state.cookieUserId)) continue // ignorer ses propres messages

      const sender = thread.users?.[0]
      nouveaux.push({
        threadId:   String(thread.thread_id),
        igAuteurId: String(sender?.pk ?? msg.user_id ?? ''),
        igAuteurNom: sender?.username ?? null,
        texte:      msg.text ?? msg.like?.unicode ?? '(media)',
      })

      if (ts > maxTs) maxTs = ts
    }

    if (maxTs > lastTs) {
      await prisma.configParam.upsert({
        where:  { cle: 'instagram.poll.last_dm_ts' },
        create: { cle: 'instagram.poll.last_dm_ts', valeur: String(maxTs), description: 'Dernier DM traité (timestamp)' },
        update: { valeur: String(maxTs) },
      })
    }
  } catch (e) {
    if (e.message?.includes('checkpoint') || e instanceof IgCheckpointError) {
      _loggedIn = false
      _checkpointPending = true
      logError(`Instagram private DMs: checkpoint requis — ${e.message}`)
    } else if (e.message?.includes('login') || e.message?.includes('401')) {
      _loggedIn = false
      logError(`Instagram private: session invalide — ${e.message}`)
    } else {
      throw e
    }
  }

  return nouveaux
}

// ── Répondre à un commentaire (via private API si Meta non dispo) ─────────────

export async function repondreCommentairePrivate(mediaId, commentaireId, texte) {
  await ensureLoggedIn()
  await ig.media.comment({
    mediaId,
    text:              texte,
    replyToCommentId:  commentaireId,
  })
}

// ── Répondre à un DM (via private API) ───────────────────────────────────────

export async function repondreDMPrivate(threadId, texte) {
  await ensureLoggedIn()
  await ig.directThread.broadcastText({ threadIds: [threadId], text: texte })
}

// ── Tester la connexion (vérifie si la session est valide, résout le checkpoint
//    si Instagram a approuvé via notification push) ──────────────────────────────

export async function testConnection() {
  try {
    const user = await ig.account.currentUser()
    // La session est valide — si un checkpoint était en attente (approuvé via notif app),
    // on le résout automatiquement
    if (_checkpointPending) {
      _checkpointPending = false
      await saveSession()
      logAction(`Instagram private: checkpoint auto-résolu via test — session valide pour @${user.username}`)
    }
    _loggedIn = true
    return {
      username:       user.username,
      fullName:       user.full_name,
      profilePicUrl:  user.profile_pic_url,
    }
  } catch (e) {
    if (e instanceof IgCheckpointError || e.message?.includes('checkpoint')) {
      _checkpointPending = true
      throw new Error('Checkpoint toujours en attente — saisis le code ou demande un renvoi')
    }
    if (e.message?.includes('login') || e.message?.includes('401')) {
      _loggedIn = false
      throw new Error('Session expirée — relance une reconnexion forcée')
    }
    throw e
  }
}

// ── Renvoyer le code de vérification checkpoint (email ou SMS) ────────────────

export async function resendCheckpointCode(method = 'email') {
  if (!_checkpointPending) throw new Error('Aucun checkpoint en attente')
  try {
    // 0 = email, 1 = SMS/téléphone
    await ig.challenge.selectVerifyMethod(method === 'sms' ? '1' : '0')
    logAction(`Instagram private: code checkpoint renvoyé via ${method}`)
  } catch {
    // Fallback : auto (true = préférer email)
    await ig.challenge.auto(method !== 'sms')
    logAction(`Instagram private: code checkpoint renvoyé via ${method} (fallback auto)`)
  }
}

// ── Forcer une reconnexion propre (efface la session — utile si mauvais compte) ─

export async function forceLogin() {
  try {
    if (existsSync(SESSION_FILE)) await unlink(SESSION_FILE)
  } catch {}
  _loggedIn          = false
  _checkpointPending = false
  logAction('Instagram private: session effacée — reconnexion forcée')
  await login()
}

// ── Lister les DMs récents (lecture seule — sans màj timestamp) ───────────────

export async function listRecentDMs(limit = 20) {
  await ensureLoggedIn()

  const threads = []
  try {
    const inbox = ig.feed.directInbox()
    const items = await inbox.items()

    for (const thread of items.slice(0, limit)) {
      const msg    = thread.items?.[0]
      const sender = thread.users?.[0]
      const ts     = msg ? Math.floor(parseInt(msg.timestamp ?? '0') / 1000) : 0

      threads.push({
        threadId:    String(thread.thread_id),
        igAuteurId:  String(sender?.pk ?? ''),
        igAuteurNom: sender?.username ?? null,
        texte:       msg?.text ?? msg?.like?.unicode ?? '(media)',
        timestamp:   ts ? new Date(ts * 1000).toISOString() : null,
        isOwn:       msg ? (msg.user_id === parseInt(ig.state.cookieUserId)) : false,
      })
    }
  } catch (e) {
    if (e.message?.includes('checkpoint') || e instanceof IgCheckpointError) {
      _loggedIn = false
      _checkpointPending = true
      logError(`Instagram private listRecentDMs: checkpoint requis — ${e.message}`)
    } else if (e.message?.includes('login') || e.message?.includes('401')) {
      _loggedIn = false
      logError(`Instagram private listRecentDMs: session invalide — ${e.message}`)
    } else {
      throw e
    }
  }

  return threads
}
