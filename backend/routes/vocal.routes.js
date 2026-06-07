/**
 * vocal.routes.js — Routes TTS / Vocal
 *
 * Endpoints :
 *   POST   /api/vocal/generate      — Lance la génération en arrière-plan, retourne sessionId
 *   GET    /api/vocal/status/:id    — État d'avancement (chunks prêts, progression)
 *   GET    /api/vocal/audio/:file   — Servir un fichier audio
 *   GET    /api/vocal/download/:id  — Télécharger la session fusionnée
 *   GET    /api/vocal/config        — Récupérer la config TTS
 *   DELETE /api/vocal/session/:id   — Nettoyer les fichiers d'une session
 */

import { Router } from 'express'
import { existsSync, createReadStream, statSync, readdirSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs'
import { resolve, basename, extname } from 'path'
import crypto from 'crypto'
import { authMiddleware } from '../middleware/auth.js'
import { logError, logAction } from '../logs/logger.js'
import { chunkText } from '../modules/vocal/chunker.js'
import {
  generateChunk, mergeChunks, getAudioCacheDir, cleanupSession
} from '../modules/vocal/tts.service.js'
import { generateChunkMistral, listMistralVoices } from '../modules/vocal/mistral.service.js'
import prisma from '../config/db.js'

const router = Router()

// Stocke les sessions de génération en cours (en mémoire)
// Map<sessionId, { chunks, results, status, error }>
const sessions = new Map()

function generateSessionId() {
  return crypto.randomBytes(6).toString('hex')
}

// ─── POST /api/vocal/generate ────────────────────────────────────────────────
// Lance la génération en arrière-plan. Retourne immédiatement un sessionId.
// Le frontend interroge ensuite GET /status/:id pour suivre la progression.

router.post('/generate', authMiddleware, async (req, res) => {
  const { text, sections, mode, size, format, speed, provider, voiceId } = req.body

  const chunkMode = ['sentences', 'words'].includes(mode) ? mode : 'sentences'
  const chunkSize = Number(size) || (chunkMode === 'sentences' ? 3 : 100)
  const audioFormat = provider === 'mistral' ? 'mp3' : (['wav', 'mp3'].includes(format) ? format : 'wav')
  const audioSpeed = Math.min(2.0, Math.max(0.5, Number(speed) || 1.0))
  const ttsProvider = provider === 'mistral' ? 'mistral' : 'piper'
  const ttsVoiceId = voiceId || ''

  // Mode multi-voix : sections [{ text, voiceId }]
  const useSections = ttsProvider === 'mistral' && Array.isArray(sections) && sections.length > 0

  let allChunks = []
  let totalChars = 0

  if (useSections) {
    // Découper chaque section, tagger les chunks avec leur voiceId
    for (const sec of sections) {
      if (!sec.text?.trim()) continue
      const { chunks } = chunkText(sec.text.trim(), chunkMode, chunkSize)
      for (const c of chunks) {
        allChunks.push({ text: c, voiceId: sec.voiceId || ttsVoiceId })
      }
      totalChars += chunks.reduce((s, c) => s + c.length, 0)
    }
  } else {
    // Mode simple : texte uniforme
    const sourceText = (text || '').trim()
    if (!sourceText) return res.status(400).json({ error: 'Texte requis' })
    const { chunks } = chunkText(sourceText, chunkMode, chunkSize)
    allChunks = chunks.map(c => ({ text: c, voiceId: ttsVoiceId }))
    totalChars = allChunks.reduce((s, c) => s + c.text.length, 0)
  }

  const chunkCount = allChunks.length
  if (chunkCount === 0) {
    return res.status(400).json({ error: 'Aucun contenu à synthétiser après découpage.' })
  }

  const estimatedMinutes = Math.ceil(totalChars / 15 / 60)

  const sessionId = generateSessionId()

  sessions.set(sessionId, {
    chunks: allChunks,
    chunkCount,
    totalChars,
    estimatedMinutes,
    format: audioFormat,
    speed: audioSpeed,
    provider: ttsProvider,
    voiceId: ttsVoiceId,
    sections: useSections ? sections : null,
    results: new Array(chunkCount).fill(null),
    currentIndex: 0,
    status: 'generating',
    error: null,
    createdAt: Date.now()
  })

  logAction(`Vocal : session ${sessionId} démarrée — ${chunkCount} chunks, ~${estimatedMinutes} min, provider: ${ttsProvider}${ttsProvider === 'mistral' ? ', multi-voix' : ''}`)

  res.json({ sessionId, chunkCount, totalChars, estimatedMinutes, format: audioFormat, speed: audioSpeed, provider: ttsProvider })

  generateInBackground(sessionId)
})

async function generateInBackground(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return

  const { chunks, chunkCount, format, speed, provider } = session

  for (let i = 0; i < chunkCount; i++) {
    session.currentIndex = i

    try {
      let result
      if (provider === 'mistral') {
        result = await generateChunkMistral(chunks[i].text, i, sessionId, chunks[i].voiceId)
      } else {
        result = await generateChunk(chunks[i].text, i, sessionId, format, speed)
      }

      session.results[i] = {
        index: i,
        url: result.url,
        filename: result.filename,
        duration: result.duration,
        size: result.size,
        text: chunks[i].text.slice(0, 200).replace(/\n/g, ' '),
        voiceId: chunks[i].voiceId || null,
        status: 'generated'
      }
      logAction(`Vocal : chunk ${i + 1}/${chunkCount} généré (${sessionId})`)
    } catch (err) {
      logError(`Vocal : échec chunk ${i} (${sessionId}) — ${err.message}`)
      session.results[i] = {
        index: i,
        url: null,
        filename: null,
        duration: 0,
        size: 0,
        text: chunks[i].text.slice(0, 200).replace(/\n/g, ' '),
        voiceId: chunks[i].voiceId || null,
        status: 'error',
        error: err.message
      }
    }
  }

  session.status = 'done'
  session.currentIndex = chunkCount
  logAction(`Vocal : session ${sessionId} terminée — ${session.results.filter(r => r?.status === 'generated').length}/${chunkCount} chunks OK`)

  // Sauvegarder le manifest sur disque
  try {
    const audioDir = getAudioCacheDir()
    if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true })
    const manifest = {
      sessionId,
      createdAt: new Date().toISOString(),
      provider: session.provider || 'piper',
      voiceId: session.voiceId || null,
      format: session.format,
      speed: session.speed,
      chunkCount: session.chunkCount,
      estimatedMinutes: session.estimatedMinutes,
      chunks: session.results.filter(r => r !== null)
    }
    writeFileSync(resolve(audioDir, `${sessionId}-manifest.json`), JSON.stringify(manifest, null, 2), 'utf-8')
  } catch (e) { logError(`Vocal : échec sauvegarde manifest ${sessionId} — ${e.message}`) }

  // Nettoyer la session mémoire après 1 heure
  setTimeout(() => {
    sessions.delete(sessionId)
  }, 3_600_000)
}

// ─── GET /api/vocal/sessions ─────────────────────────────────────────────────
// Liste les sessions passées (lit les manifests sur disque)

router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const audioDir = getAudioCacheDir()
    if (!existsSync(audioDir)) return res.json([])

    const files = readdirSync(audioDir).filter(f => f.endsWith('-manifest.json'))
    const sessions = []
    for (const f of files) {
      try {
        const content = JSON.parse(readFileSync(resolve(audioDir, f), 'utf-8'))
        sessions.push({
          sessionId: content.sessionId,
          createdAt: content.createdAt,
          provider: content.provider || 'piper',
          format: content.format,
          chunkCount: content.chunkCount,
          estimatedMinutes: content.estimatedMinutes,
          generatedCount: content.chunks?.length || 0
        })
      } catch { /* manifest corrompu, on ignore */ }
    }
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json(sessions)
  } catch (err) {
    logError(`GET /vocal/sessions : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ─── GET /api/vocal/manifest/:sessionId ──────────────────────────────────────
// Retourne le manifest complet d'une session (pour replay)

router.get('/manifest/:sessionId', authMiddleware, async (req, res) => {
  try {
    const audioDir = getAudioCacheDir()
    const manifestPath = resolve(audioDir, `${req.params.sessionId}-manifest.json`)
    if (!existsSync(manifestPath)) return res.status(404).json({ error: 'Session introuvable' })
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    // Vérifier que les fichiers existent encore
    manifest.chunks = manifest.chunks.filter(c => c.filename && existsSync(resolve(audioDir, c.filename)))
    res.json(manifest)
  } catch (err) {
    logError(`GET /vocal/manifest : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ─── DELETE /api/vocal/session/:sessionId ────────────────────────────────────
// Supprime tous les fichiers d'une session + manifest

router.delete('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params
    sessions.delete(sessionId)
    const deleted = await cleanupSession(sessionId)
    // Supprimer aussi le manifest
    const audioDir = getAudioCacheDir()
    const manifestPath = resolve(audioDir, `${sessionId}-manifest.json`)
    if (existsSync(manifestPath)) unlinkSync(manifestPath)
    res.json({ deleted, sessionId })
  } catch (err) {
    logError(`DELETE /vocal/session : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ─── GET /api/vocal/status/:sessionId ────────────────────────────────────────
// Le frontend appelle cette route toutes les ~1.5 secondes pour récupérer
// les nouveaux chunks générés.

router.get('/status/:sessionId', authMiddleware, async (req, res) => {
  const { sessionId } = req.params
  const session = sessions.get(sessionId)

  if (!session) {
    return res.status(404).json({ error: 'Session introuvable ou expirée.' })
  }

  // Ne renvoyer que les chunks non encore envoyés au client
  const since = parseInt(req.query.since) || 0

  const newChunks = []
  for (let i = since; i < session.results.length; i++) {
    if (session.results[i] !== null) {
      newChunks.push(session.results[i])
    } else {
      break // Ne pas sauter les chunks pas encore générés
    }
  }

  res.json({
    sessionId,
    chunkCount: session.chunkCount,
    status: session.status,
    currentIndex: session.currentIndex,
    estimatedMinutes: session.estimatedMinutes,
    mergeUrl: session.status === 'done' ? `/api/vocal/download/${sessionId}` : null,
    newChunks
  })
})

// ─── GET /api/vocal/audio/:filename ──────────────────────────────────────────
// Sert les fichiers audio générés (WAV ou MP3).
// PAS d'auth — les noms de fichier sont aléatoires (sessionId hex) et le
// navigateur ne peut pas envoyer de header Authorization sur <audio src>.

router.get('/audio/:filename', async (req, res) => {
  try {
    const audioDir = getAudioCacheDir()
    const filename = basename(req.params.filename)
    const filePath = resolve(audioDir, filename)

    if (!filePath.startsWith(audioDir)) {
      return res.status(403).json({ error: 'Accès interdit' })
    }

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier audio introuvable' })
    }

    const ext = extname(filename).toLowerCase()
    const contentType = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
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
// PAS d'auth — les noms de session sont aléatoires (12 car. hex)

router.get('/download/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params

    if (!/^[a-f0-9]{12}$/.test(sessionId)) {
      return res.status(400).json({ error: 'ID de session invalide' })
    }

    const audioDir = getAudioCacheDir()
    const mergedWav = resolve(audioDir, `${sessionId}-merged.wav`)
    const mergedMp3 = resolve(audioDir, `${sessionId}-merged.mp3`)

    let merged
    if (existsSync(mergedMp3)) {
      merged = { path: mergedMp3, ext: 'mp3', type: 'audio/mpeg' }
    } else if (existsSync(mergedWav)) {
      merged = { path: mergedWav, ext: 'wav', type: 'audio/wav' }
    }

    if (!merged) {
      let files = []
      try {
        files = readdirSync(audioDir)
          .filter(f => f.includes(sessionId) && (f.endsWith('.wav') || f.endsWith('.mp3')))
          .sort()
      } catch { /* dir pas encore créé */ }

      if (files.length === 0) {
        return res.status(404).json({ error: 'Aucun fichier trouvé pour cette session.' })
      }

      const mp3Count = files.filter(f => f.endsWith('.mp3')).length
      const fmt = mp3Count > 0 ? 'mp3' : 'wav'
      const result = await mergeChunks(sessionId, fmt)
      const ext = result.filename.endsWith('.mp3') ? 'mp3' : 'wav'
      merged = { path: result.path, ext, type: ext === 'mp3' ? 'audio/mpeg' : 'audio/wav' }
    }

    const filename = `eva-tts-${sessionId}.${merged.ext}`
    res.setHeader('Content-Type', merged.type)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', statSync(merged.path).size)
    res.setHeader('Cache-Control', 'private, max-age=3600')

    createReadStream(merged.path).pipe(res)
    logAction(`Vocal : téléchargement session ${sessionId}`)
  } catch (err) {
    logError(`GET /vocal/download : ${err.message}`)
    res.status(500).json({ error: 'Erreur lors de la fusion : ' + err.message })
  }
})

// ─── GET /api/vocal/mistral-voices ───────────────────────────────────────────
// Liste les voix Voxtral disponibles (via l'API Mistral, caché 1h)

router.get('/mistral-voices', authMiddleware, async (req, res) => {
  try {
    const voices = await listMistralVoices()
    res.json(voices)
  } catch (err) {
    logError(`GET /vocal/mistral-voices : ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/vocal/config ───────────────────────────────────────────────────

router.get('/config', authMiddleware, async (req, res) => {
  try {
    const params = await prisma.configParam.findMany({
      where: { cle: { startsWith: 'vocal.' } }
    })
    const config = {}
    for (const p of params) {
      config[p.cle.replace('vocal.', '')] = p.valeur
    }
    res.json(config)
  } catch (err) {
    logError(`GET /vocal/config : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ─── DELETE /api/vocal/session/:sessionId ────────────────────────────────────

router.delete('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params
    sessions.delete(sessionId)
    const deleted = await cleanupSession(sessionId)
    res.json({ deleted, sessionId })
  } catch (err) {
    logError(`DELETE /vocal/session : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
