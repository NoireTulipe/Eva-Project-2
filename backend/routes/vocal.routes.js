/**
 * vocal.routes.js — Routes TTS / Vocal
 *
 * Endpoints :
 *   POST   /api/vocal/generate      — SSE : génération streaming des chunks audio
 *   GET    /api/vocal/audio/:file   — Servir un fichier audio
 *   GET    /api/vocal/download/:id  — Télécharger la session fusionnée
 *   GET    /api/vocal/config        — Récupérer la config TTS
 *   DELETE /api/vocal/session/:id   — Nettoyer les fichiers d'une session
 */

import { Router } from 'express'
import { existsSync, createReadStream, statSync, readdirSync } from 'fs'
import { resolve, basename, extname } from 'path'
import crypto from 'crypto'
import { authMiddleware } from '../middleware/auth.js'
import { logError, logAction } from '../logs/logger.js'
import { chunkText } from '../modules/vocal/chunker.js'
import {
  generateChunk, mergeChunks, getAudioCacheDir, cleanupSession
} from '../modules/vocal/tts.service.js'
import prisma from '../config/db.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function sendSSE(res, event, data) {
  if (!res.writable) return
  try {
    sse(res, event, data)
  } catch { /* connexion fermée */ }
}

function generateSessionId() {
  return crypto.randomBytes(6).toString('hex') // 12 caractères
}

// ─── POST /api/vocal/generate ────────────────────────────────────────────────
// Endpoint SSE de génération streaming.
// Reçoit le texte et les paramètres, stream les événements au fur et à mesure
// que les chunks audio sont générés.

router.post('/generate', authMiddleware, async (req, res) => {
  const { text, mode, size, format, speed } = req.body

  // Validation
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Texte requis' })
  }

  const chunkMode = ['sentences', 'words'].includes(mode) ? mode : 'sentences'
  const chunkSize = Number(size) || (chunkMode === 'sentences' ? 3 : 100)
  const audioFormat = ['wav', 'mp3'].includes(format) ? format : 'wav'
  const audioSpeed = Math.min(2.0, Math.max(0.5, Number(speed) || 1.0))

  // Configurer SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.flushHeaders()

  // Désactiver le timeout — la génération peut être longue
  req.socket.setTimeout(0)
  req.socket.setNoDelay(true)
  req.socket.setKeepAlive(true)

  let aborted = false

  req.on('close', () => {
    aborted = true
    logAction('Vocal SSE : connexion fermée par le client')
  })

  const sessionId = generateSessionId()

  try {
    // Découpage du texte
    const { chunks, chunkCount, totalChars, estimatedMinutes } = chunkText(
      text.trim(), chunkMode, chunkSize
    )

    if (chunkCount === 0) {
      sendSSE(res, 'error', { message: 'Aucun contenu à synthétiser après découpage.' })
      sendSSE(res, 'done', { sessionId, chunkCount: 0 })
      return res.end()
    }

    logAction(`Vocal SSE : session ${sessionId} — ${chunkCount} chunks, ~${estimatedMinutes} min d'audio`)

    // Événement de début
    sendSSE(res, 'start', {
      sessionId,
      chunkCount,
      totalChars,
      estimatedMinutes,
      format: audioFormat,
      speed: audioSpeed
    })

    // Génération séquentielle
    const generated = []

    for (let i = 0; i < chunkCount; i++) {
      if (aborted) break

      // Heartbeat avant le chunk (tient la connexion active)
      sendSSE(res, 'progress', { current: i, total: chunkCount })

      try {
        const result = await generateChunk(
          chunks[i], i, sessionId, audioFormat, audioSpeed
        )
        generated.push(result)

        sendSSE(res, 'chunk', {
          index: i,
          url: result.url,
          filename: result.filename,
          duration: result.duration,
          size: result.size,
          text: chunks[i].slice(0, 200) // Début du texte pour affichage
        })
      } catch (err) {
        logError(`Vocal SSE : échec chunk ${i} — ${err.message}`)
        sendSSE(res, 'chunk_error', {
          index: i,
          message: err.message
        })
        // Continuer avec les chunks suivants
      }
    }

    if (!aborted) {
      sendSSE(res, 'done', {
        sessionId,
        chunkCount: generated.length,
        mergeUrl: `/api/vocal/download/${sessionId}`,
        generatedCount: generated.length
      })
    }

    res.end()
  } catch (err) {
    logError(`Vocal SSE : erreur fatale — ${err.message}`)
    if (!aborted) {
      sendSSE(res, 'error', { message: err.message })
    }
    res.end()
  }
})

// ─── GET /api/vocal/audio/:filename ──────────────────────────────────────────
// Sert les fichiers audio générés (WAV ou MP3).
// PAS d'auth — les noms de fichier sont aléatoires (sessionId hex) et le
// navigateur ne peut pas envoyer de header Authorization sur <audio src>.

router.get('/audio/:filename', async (req, res) => {
  try {
    const audioDir = getAudioCacheDir()
    const filename = basename(req.params.filename) // Sécurité : strip path
    const filePath = resolve(audioDir, filename)

    // Vérifier que le fichier est bien dans audio_cache (protection path traversal)
    if (!filePath.startsWith(audioDir)) {
      return res.status(403).json({ error: 'Accès interdit' })
    }

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier audio introuvable' })
    }

    const ext = extname(filename).toLowerCase()
    const contentType = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400') // 24h
    res.setHeader('Accept-Ranges', 'bytes')

    const stat = statSync(filePath)
    res.setHeader('Content-Length', stat.size)

    const stream = createReadStream(filePath)
    stream.pipe(res)
  } catch (err) {
    logError(`GET /vocal/audio : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ─── GET /api/vocal/download/:sessionId ──────────────────────────────────────
// Fusionne et télécharge tous les chunks d'une session.

router.get('/download/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params

    // SessionId = 12 caractères hex — valider le format
    if (!/^[a-f0-9]{12}$/.test(sessionId)) {
      return res.status(400).json({ error: 'ID de session invalide' })
    }

    const audioDir = getAudioCacheDir()

    // Vérifier si déjà fusionné
    const mergedWav = resolve(audioDir, `${sessionId}-merged.wav`)
    const mergedMp3 = resolve(audioDir, `${sessionId}-merged.mp3`)

    let merged
    if (existsSync(mergedMp3)) {
      merged = { path: mergedMp3, ext: 'mp3', type: 'audio/mpeg' }
    } else if (existsSync(mergedWav)) {
      merged = { path: mergedWav, ext: 'wav', type: 'audio/wav' }
    }

    if (!merged) {
      // Pas de fichier fusionné, essayer de fusionner à la volée
      // Détecter le format à partir des fichiers existants
      let files = []
      try {
        files = readdirSync(audioDir)
          .filter(f => f.includes(sessionId) && (f.endsWith('.wav') || f.endsWith('.mp3')))
          .sort()
      } catch { /* audioDir pas encore créé */ }

      if (files.length === 0) {
        return res.status(404).json({ error: 'Aucun fichier trouvé pour cette session. Les fichiers ont peut-être expiré.' })
      }

      // Déterminer le format majoritaire
      const mp3Count = files.filter(f => f.endsWith('.mp3')).length
      const fmt = mp3Count > 0 ? 'mp3' : 'wav'

      const result = await mergeChunks(sessionId, fmt)
      const ext = result.filename.endsWith('.mp3') ? 'mp3' : 'wav'
      merged = {
        path: result.path,
        ext,
        type: ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'
      }
    }

    const filename = `eva-tts-${sessionId}.${merged.ext}`
    res.setHeader('Content-Type', merged.type)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', statSync(merged.path).size)
    res.setHeader('Cache-Control', 'private, max-age=3600')

    const stream = createReadStream(merged.path)
    stream.pipe(res)

    logAction(`Vocal : téléchargement session ${sessionId} → ${filename}`)
  } catch (err) {
    logError(`GET /vocal/download : ${err.message}`)
    res.status(500).json({ error: 'Erreur lors de la fusion : ' + err.message })
  }
})

// ─── GET /api/vocal/config ───────────────────────────────────────────────────
// Retourne la configuration TTS lisible par le frontend.

router.get('/config', authMiddleware, async (req, res) => {
  try {
    const params = await prisma.configParam.findMany({
      where: { cle: { startsWith: 'vocal.' } }
    })
    const config = {}
    for (const p of params) {
      const key = p.cle.replace('vocal.', '')
      config[key] = p.valeur
    }
    res.json(config)
  } catch (err) {
    logError(`GET /vocal/config : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ─── DELETE /api/vocal/session/:sessionId ────────────────────────────────────
// Nettoie les fichiers d'une session spécifique.

router.delete('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params
    const deleted = await cleanupSession(sessionId)
    res.json({ deleted, sessionId })
  } catch (err) {
    logError(`DELETE /vocal/session : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
