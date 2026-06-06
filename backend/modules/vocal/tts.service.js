/**
 * tts.service.js — Wrapper Piper TTS + ffmpeg
 *
 * Fonctions :
 *   - generateChunk()   : texte → Piper → WAV (puis ffmpeg → MP3 si demandé)
 *   - mergeChunks()     : concatène tous les WAV/MP3 d'une session avec ffmpeg
 *   - cleanupOldFiles() : supprime les fichiers > retention_days
 *   - getAudioDuration(): lit l'en-tête WAV pour estimer la durée
 *
 * Adapté du ttsService.js d'EVA v1 (C:\...\Eva\src\services\ttsService.js)
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import {
  existsSync, mkdirSync, readdirSync, unlinkSync, statSync,
  writeFileSync, readFileSync
} from 'fs'
import { resolve, dirname, basename, extname } from 'path'
import { fileURLToPath } from 'url'
import prisma from '../../config/db.js'
import { logAction, logError } from '../../logs/logger.js'
import { sanitizeText } from './chunker.js'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Helpers Config ──────────────────────────────────────────────────────────

let _configCache = null
let _configCacheTime = 0
const CONFIG_TTL = 60_000 // 1 minute

async function getConfig() {
  const now = Date.now()
  if (_configCache && (now - _configCacheTime) < CONFIG_TTL) return _configCache

  const params = await prisma.configParam.findMany({
    where: { cle: { startsWith: 'vocal.' } }
  })
  const map = {}
  for (const p of params) {
    map[p.cle.replace('vocal.', '')] = p.valeur
  }

  // Valeurs par défaut
  _configCache = {
    piper_path:     map.piper_path     || 'vendor/piper/piper',
    model_path:     map.model_path     || 'vendor/models/fr_FR-siwis-medium.onnx',
    audio_cache:    map.audio_cache    || './audio_cache/',
    retention_days: parseInt(map.retention_days || '7', 10),
    default_speed:  parseFloat(map.default_speed || '1.0'),
    default_format: map.default_format || 'wav',
    ffmpeg_path:    map.ffmpeg_path    || 'ffmpeg'
  }
  _configCacheTime = now
  return _configCache
}

export function getAudioCacheDir() {
  return resolve(__dirname, '..', '..', 'audio_cache')
}

// ─── Génération d'un chunk ───────────────────────────────────────────────────

/**
 * Génère un fichier audio depuis un texte via Piper.
 *
 * @param {string} text       - Texte à synthétiser
 * @param {number} index      - Index du chunk (pour le nom de fichier)
 * @param {string} sessionId  - ID de session (pour le nom de fichier)
 * @param {string} format     - 'wav' | 'mp3'
 * @param {number} speed      - Vitesse Piper (length-scale, 1.0 = normal)
 * @returns {Promise<{ path: string, url: string, duration: number, size: number }>}
 */
export async function generateChunk(text, index, sessionId, format = 'wav', speed = 1.0) {
  const config = await getConfig()
  const audioDir = getAudioCacheDir()

  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true })
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const baseName = `${date}-${sessionId}-${String(index).padStart(4, '0')}`
  const wavPath = resolve(audioDir, `${baseName}.wav`)

  const sanitized = sanitizeText(text)

  // Résoudre les chemins absolus pour Piper et le modèle
  const piperBin = resolve(__dirname, '..', '..', config.piper_path)
  const modelFile = resolve(__dirname, '..', '..', config.model_path)

  // Vérifier que Piper existe
  if (!existsSync(piperBin)) {
    throw new Error(`Piper introuvable : ${piperBin}. Vérifiez le chemin dans Admin > Paramétrage.`)
  }
  if (!existsSync(modelFile)) {
    throw new Error(`Modèle vocal introuvable : ${modelFile}. Vérifiez le chemin dans Admin > Paramétrage.`)
  }

  // Construire la commande Piper
  // On utilise echo via shell pour alimenter Piper en stdin
  const pipeCmd = `echo "${sanitized}" | "${piperBin}" --model "${modelFile}" --output_file "${wavPath}" --length-scale ${speed} 2>/dev/null`

  try {
    await execAsync(pipeCmd, { timeout: 60_000 }) // 60s timeout par chunk
    logAction(`Vocal TTS : chunk ${index} généré (${basename(wavPath)})`)
  } catch (err) {
    logError(`Piper échec chunk ${index} : ${err.message}`)
    throw new Error(`Erreur Piper sur le chunk ${index} : ${err.message}`)
  }

  // Si MP3 demandé, convertir avec ffmpeg
  let finalPath = wavPath
  let finalExt = 'wav'

  if (format === 'mp3') {
    const mp3Path = resolve(audioDir, `${baseName}.mp3`)
    const ffmpegBin = config.ffmpeg_path

    try {
      await execAsync(
        `"${ffmpegBin}" -y -i "${wavPath}" -codec:a libmp3lame -b:a 128k "${mp3Path}" 2>/dev/null`,
        { timeout: 30_000 }
      )
      // Supprimer le WAV original
      if (existsSync(wavPath)) unlinkSync(wavPath)
      finalPath = mp3Path
      finalExt = 'mp3'
      logAction(`Vocal TTS : chunk ${index} converti en MP3`)
    } catch (err) {
      logError(`ffmpeg échec conversion MP3 chunk ${index} : ${err.message}`)
      // Fallback : on garde le WAV
      logAction(`Vocal TTS : fallback WAV pour le chunk ${index}`)
    }
  }

  const size = statSync(finalPath).size
  const duration = getWavDuration(finalPath)

  return {
    path: finalPath,
    url: `/api/vocal/audio/${basename(finalPath)}`,
    filename: basename(finalPath),
    duration,
    size
  }
}

// ─── Durée audio ─────────────────────────────────────────────────────────────

/**
 * Estime la durée d'un fichier WAV à partir de son en-tête.
 * Retourne la durée en secondes (approximation).
 */
function getWavDuration(filePath) {
  try {
    if (!filePath.endsWith('.wav')) return 0

    const fd = readFileSync(filePath)
    if (fd.length < 44) return 0

    // Vérifier le magic number "RIFF"
    if (fd.toString('ascii', 0, 4) !== 'RIFF') return 0
    if (fd.toString('ascii', 8, 12) !== 'WAVE') return 0

    // Lire le format audio (offset 20) — doit être 1 (PCM)
    // Lire sampleRate (offset 24), byteRate (offset 28), dataSize (offset 40)
    const byteRate = fd.readUInt32LE(28)
    const dataSize = fd.readUInt32LE(40)

    if (byteRate === 0) return 0
    return Math.round(dataSize / byteRate)
  } catch {
    return 0
  }
}

// ─── Fusion des chunks ───────────────────────────────────────────────────────

/**
 * Fusionne tous les chunks d'une session en un seul fichier.
 *
 * @param {string} sessionId
 * @param {string} format - 'wav' | 'mp3'
 * @returns {Promise<{ path: string, url: string, size: number }>}
 */
export async function mergeChunks(sessionId, format = 'wav') {
  const config = await getConfig()
  const audioDir = getAudioCacheDir()

  // Lister les fichiers de cette session
  const allFiles = readdirSync(audioDir).filter(f => {
    const ext = extname(f).toLowerCase()
    return f.includes(sessionId) && (ext === '.wav' || ext === '.mp3')
  }).sort()

  if (allFiles.length === 0) {
    throw new Error(`Aucun fichier trouvé pour la session ${sessionId}`)
  }

  // Si un seul fichier, pas besoin de fusionner
  if (allFiles.length === 1) {
    const filePath = resolve(audioDir, allFiles[0])
    const ext = extname(allFiles[0]).toLowerCase().slice(1)
    return {
      path: filePath,
      url: `/api/vocal/download/${sessionId}`,
      size: statSync(filePath).size,
      filename: allFiles[0]
    }
  }

  const mergedExt = format === 'mp3' ? 'mp3' : 'wav'
  const mergedName = `${sessionId}-merged.${mergedExt}`
  const mergedPath = resolve(audioDir, mergedName)

  // Si déjà fusionné, servir le cache
  if (existsSync(mergedPath)) {
    return {
      path: mergedPath,
      url: `/api/vocal/download/${sessionId}`,
      size: statSync(mergedPath).size,
      filename: mergedName
    }
  }

  // Créer un fichier de liste pour ffmpeg concat
  const listPath = resolve(audioDir, `${sessionId}-list.txt`)
  const lines = allFiles.map(f => `file '${resolve(audioDir, f).replace(/'/g, "'\\''")}'`)
  writeFileSync(listPath, lines.join('\n'), 'utf-8')

  const ffmpegBin = config.ffmpeg_path

  try {
    // Pour WAV : concat avec ffmpeg (re-encode, car concat copy sur WAV brut est risqué)
    // Pour MP3 : concat avec codec copy
    const codecOpt = format === 'mp3' ? '-c copy' : ''
    await execAsync(
      `"${ffmpegBin}" -y -f concat -safe 0 -i "${listPath}" ${codecOpt} "${mergedPath}" 2>/dev/null`,
      { timeout: 120_000 }
    )
    logAction(`Vocal TTS : fusion ${allFiles.length} fichiers → ${mergedName}`)
  } catch (err) {
    logError(`ffmpeg fusion échec : ${err.message}`)
    throw new Error(`Erreur lors de la fusion des fichiers : ${err.message}`)
  } finally {
    // Nettoyer le fichier de liste
    if (existsSync(listPath)) unlinkSync(listPath)
  }

  return {
    path: mergedPath,
    url: `/api/vocal/download/${sessionId}`,
    size: statSync(mergedPath).size,
    filename: mergedName
  }
}

// ─── Nettoyage ───────────────────────────────────────────────────────────────

/**
 * Supprime les fichiers audio plus vieux que retention_days.
 * Appelé par le cron quotidien.
 *
 * @returns {Promise<number>} Nombre de fichiers supprimés
 */
export async function cleanupOldFiles() {
  const config = await getConfig()
  const audioDir = getAudioCacheDir()

  if (!existsSync(audioDir)) return 0

  const files = readdirSync(audioDir).filter(f => {
    const ext = extname(f).toLowerCase()
    return ext === '.wav' || ext === '.mp3' || ext === '.txt'
  })

  const limitDate = new Date()
  limitDate.setDate(limitDate.getDate() - config.retention_days)

  let deleted = 0

  for (const file of files) {
    // Format : YYYYMMDD-SESSIONID-INDEX.ext ou YYYYMMDD-SESSIONID-merged.ext
    const match = file.match(/^(\d{8})-/)
    if (!match) continue

    const fileDate = match[1]
    const year  = parseInt(fileDate.slice(0, 4), 10)
    const month = parseInt(fileDate.slice(4, 6), 10) - 1
    const day   = parseInt(fileDate.slice(6, 8), 10)

    const fileDateObj = new Date(year, month, day)

    if (fileDateObj <= limitDate) {
      try {
        unlinkSync(resolve(audioDir, file))
        deleted++
      } catch (e) {
        logError(`Vocal cleanup : impossible de supprimer ${file}`)
      }
    }
  }

  if (deleted > 0) {
    logAction(`Vocal TTS : nettoyage — ${deleted} fichier(s) supprimé(s)`)
  }

  return deleted
}

/**
 * Nettoie les fichiers d'une session spécifique.
 * Utile après un téléchargement si l'utilisateur veut libérer de l'espace.
 */
export async function cleanupSession(sessionId) {
  const audioDir = getAudioCacheDir()
  if (!existsSync(audioDir)) return 0

  const files = readdirSync(audioDir).filter(f => f.includes(sessionId))
  let deleted = 0

  for (const file of files) {
    try {
      unlinkSync(resolve(audioDir, file))
      deleted++
    } catch { /* ignore */ }
  }

  return deleted
}
