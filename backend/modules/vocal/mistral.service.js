/**
 * mistral.service.js — Synthèse vocale via Voxtral (Mistral AI)
 *
 * Appelle l'API Mistral Voxtral, récupère l'audio en base64,
 * le sauvegarde en MP3 sur disque.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, basename } from 'path'
import dotenv from 'dotenv'
import { resolve as resolvePath, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Mistral } from '@mistralai/mistralai'
import { logAction, logError } from '../../logs/logger.js'
import { getAudioCacheDir } from './tts.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getApiKey() {
  // Lire depuis .env (rechargé à chaque appel pour rester à jour)
  dotenv.config({ path: resolvePath(__dirname, '..', '..', '..', '.env') })
  return process.env.VOXTRAL_API_KEY || process.env.MISTRAL_API_KEY || ''
}

/**
 * Génère un chunk audio via l'API Voxtral de Mistral.
 *
 * @param {string} text     - Texte à synthétiser
 * @param {number} index    - Index du chunk (pour le nom de fichier)
 * @param {string} sessionId - ID de session
 * @param {string} voiceId  - ID de la voix (ex: 'fr_female', 'neutral_male'…)
 * @returns {Promise<{ path: string, url: string, filename: string, duration: number, size: number }>}
 */
export async function generateChunkMistral(text, index, sessionId, voiceId = 'fr_female') {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Clé API Voxtral absente. Définissez VOXTRAL_API_KEY dans le .env')
  }

  const audioDir = getAudioCacheDir()
  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true })
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const baseName = `${date}-${sessionId}-${String(index).padStart(4, '0')}`
  const mp3Path = resolve(audioDir, `${baseName}.mp3`)

  const body = {
    model: 'voxtral-mini-tts-2603',
    input: text,
    voice_id: voiceId,
    response_format: 'mp3'
  }

  // Timeout 30 secondes pour l'appel API
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  let response
  try {
    response = await fetch('https://api.mistral.ai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch (err) {
    clearTimeout(timeout)
    throw new Error(`Voxtral : échec requête — ${err.name === 'AbortError' ? 'timeout (30s)' : err.message}`)
  }
  clearTimeout(timeout)

  if (!response.ok) {
    let detail = ''
    try { const e = await response.json(); detail = e.detail || e.message || '' } catch {}
    throw new Error(`Voxtral : HTTP ${response.status} ${detail}`)
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('Voxtral : réponse JSON invalide')
  }

  const base64 = data.audio_data
  if (!base64) {
    throw new Error('Voxtral : pas de audio_data dans la réponse')
  }

  // Sauvegarder le MP3 sur disque
  const buffer = Buffer.from(base64, 'base64')
  writeFileSync(mp3Path, buffer)

  const size = buffer.length
  // Estimation durée : ~128 kbps MP3 → 1 octet = 1/16000 seconde
  const duration = Math.round(size / 16000)

  logAction(`Voxtral : chunk ${index} généré (${basename(mp3Path)}, ${(size / 1024).toFixed(1)} Ko, voix: ${voiceId})`)

  return {
    path: mp3Path,
    url: `/api/vocal/audio/${basename(mp3Path)}`,
    filename: basename(mp3Path),
    duration,
    size
  }
}

// ─── Cache des voix ──────────────────────────────────────────────────────────

let _voicesCache = null
let _voicesCacheTime = 0
const VOICES_CACHE_TTL = 3_600_000 // 1 heure

/**
 * Liste toutes les voix Voxtral disponibles via l'API Mistral.
 * Résultat caché 1 heure (les voix changent rarement).
 *
 * @returns {Promise<Array<{ id: string, name: string, languages: string[] }>>}
 */
export async function listMistralVoices() {
  const now = Date.now()
  if (_voicesCache && (now - _voicesCacheTime) < VOICES_CACHE_TTL) {
    return _voicesCache
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Clé API Voxtral absente. Définissez VOXTRAL_API_KEY dans le .env')
  }

  const client = new Mistral({ apiKey })
  const allVoices = []
  let offset = 0
  const limit = 50

  while (true) {
    const page = await client.audio.voices.list({ limit, offset })
    allVoices.push(...(page.items ?? []))
    if (offset + (page.items?.length ?? 0) >= (page.total ?? 0)) break
    offset += page.items?.length ?? 0
  }

  const voices = allVoices.map(v => ({
    id: v.id,
    name: v.name,
    languages: v.languages ?? []
  }))

  _voicesCache = voices
  _voicesCacheTime = now
  logAction(`Voxtral : ${voices.length} voix chargées depuis l'API`)

  return voices
}
