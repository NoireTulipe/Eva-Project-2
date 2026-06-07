/**
 * montage.service.js — Logique ffmpeg pour l'éditeur de montage audio
 *
 * - trimPreview() : extrait de prévisualisation pour le trim
 * - exportMontage() : fusion multi-pistes avec ffmpeg
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs'
import { resolve, basename, extname } from 'path'
import crypto from 'crypto'
import { logAction, logError } from '../../logs/logger.js'
import { getAudioCacheDir } from './tts.service.js'
import prisma from '../../config/db.js'

const execAsync = promisify(exec)

function getFfmpegPath() {
  return 'ffmpeg'
}

export function getUploadsDir() {
  const dir = resolve(getAudioCacheDir(), '..', 'uploads', 'montage')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// ─── Preview trim ────────────────────────────────────────────────────────────

/**
 * Génère un court extrait audio pour prévisualiser un point de trim.
 * @param {string} filePath - Chemin absolu du fichier source
 * @param {number} position - Position en secondes (trimIn ou duration-trimOut)
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function trimPreview(filePath, position) {
  if (!existsSync(filePath)) throw new Error('Fichier source introuvable')

  const previewDir = resolve(getAudioCacheDir(), 'previews')
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true })

  const previewName = `preview-${crypto.randomBytes(4).toString('hex')}.mp3`
  const previewPath = resolve(previewDir, previewName)

  // Extraire 3 secondes à partir de la position
  const start = Math.max(0, position)
  const ffmpeg = getFfmpegPath()
  await execAsync(`"${ffmpeg}" -y -ss ${start} -t 3 -i "${filePath}" -codec:a libmp3lame -b:a 128k "${previewPath}" 2>/dev/null`)

  return { url: `/api/montage/preview-file/${previewName}`, path: previewPath }
}

// ─── Export montage ──────────────────────────────────────────────────────────

/**
 * Fusionne toutes les pistes en un fichier MP3.
 * @param {object} project - Projet montage { tracks: [...] }
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function exportMontage(project) {
  const exportsDir = resolve(getAudioCacheDir(), 'exports')
  if (!existsSync(exportsDir)) mkdirSync(exportsDir, { recursive: true })

  const exportName = `montage-${crypto.randomBytes(6).toString('hex')}.mp3`
  const exportPath = resolve(exportsDir, exportName)

  // Collecter tous les blocs
  const allBlocks = []
  for (const track of project.tracks || []) {
    for (const block of track.blocks || []) {
      if (!block.file) continue
      const filePath = resolveAudioPath(block.file)
      if (!existsSync(filePath)) continue

      const trimIn = block.trimIn || 0
      const trimOut = block.trimOut || 0
      const effectiveDuration = block.duration - trimIn - trimOut
      if (effectiveDuration <= 0) continue

      allBlocks.push({
        filePath,
        start: block.start || 0,
        trimIn,
        effectiveDuration,
        volume: block.volume ?? 1.0
      })
    }
  }

  if (allBlocks.length === 0) throw new Error('Aucun bloc audio valide à exporter')

  // Construire le filter_complex ffmpeg
  const inputs = allBlocks.map(b => `-i "${b.filePath}"`).join(' ')
  const filters = allBlocks.map((b, i) => {
    const delayMs = Math.round(b.start * 1000)
    const vol = b.volume ?? 1.0
    return `[${i}:a]atrim=${b.trimIn}:${b.trimIn + b.effectiveDuration},volume=${vol},adelay=${delayMs}|${delayMs}[a${i}]`
  }).join('; ')

  const amixInputs = allBlocks.map((_, i) => `[a${i}]`).join('')
  const ffmpeg = getFfmpegPath()

  const cmd = `"${ffmpeg}" -y ${inputs} -filter_complex "${filters}; ${amixInputs}amix=inputs=${allBlocks.length}:duration=longest:normalize=0" -codec:a libmp3lame -b:a 192k "${exportPath}" 2>/dev/null`

  logAction(`Montage export : ${allBlocks.length} blocs → ${exportName}`)

  try {
    await execAsync(cmd, { timeout: 120_000 })
  } catch (err) {
    logError(`Montage export ffmpeg : ${err.message}`)
    throw new Error(`Erreur ffmpeg lors de l'export : ${err.message}`)
  }

  if (!existsSync(exportPath)) {
    throw new Error('Export échoué : fichier non généré')
  }

  return { url: `/api/montage/export-file/${exportName}`, path: exportPath }
}

// ─── Sources audio ───────────────────────────────────────────────────────────

/**
 * Liste toutes les sources audio disponibles pour le montage.
 */
export async function listSources() {
  const vocal = []
  const audioDir = getAudioCacheDir()

  // Sessions vocales (manifests)
  if (existsSync(audioDir)) {
    const manifests = readdirSync(audioDir).filter(f => f.endsWith('-manifest.json'))
    for (const mf of manifests) {
      try {
        const m = JSON.parse(readFileSync(resolve(audioDir, mf), 'utf-8'))
        const chunks = (m.chunks || []).filter(c => c.status === 'generated' && c.url && c.filename && existsSync(resolve(audioDir, c.filename)))
        if (chunks.length > 0) {
          vocal.push({
            sessionId: m.sessionId,
            createdAt: m.createdAt,
            provider: m.provider || 'piper',
            format: m.format || 'wav',
            chunks: chunks.map(c => ({ ...c, file: c.url, label: c.text?.slice(0, 80) || `Seg. ${c.index + 1}` }))
          })
        }
      } catch {}
    }
  }

  // Uploads
  const uploads = []
  const uploadsDir = getUploadsDir()
  if (existsSync(uploadsDir)) {
    const files = readdirSync(uploadsDir).filter(f => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f))
    uploads.push(...files.map(f => ({
      name: f,
      file: `/api/montage/upload-file/${f}`,
      label: f.replace(/\.[^.]+$/, '')
    })))
  }

  return { vocal, uploads }
}

// ─── Projets ─────────────────────────────────────────────────────────────────

export function getProjectPath(id) {
  return resolve(getAudioCacheDir(), `montage-${id}.json`)
}

export function saveProject(id, project) {
  const dir = getAudioCacheDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(getProjectPath(id), JSON.stringify(project, null, 2), 'utf-8')
  logAction(`Montage : projet ${id} sauvegardé`)
}

export function loadProject(id) {
  const p = getProjectPath(id)
  if (!existsSync(p)) throw new Error('Projet introuvable')
  return JSON.parse(readFileSync(p, 'utf-8'))
}

export function listProjects() {
  const dir = getAudioCacheDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.startsWith('montage-') && f.endsWith('.json'))
    .map(f => {
      try {
        const p = JSON.parse(readFileSync(resolve(dir, f), 'utf-8'))
        return { id: p.id, name: p.name, updatedAt: p.updatedAt, trackCount: p.tracks?.length || 0, blockCount: p.tracks?.reduce((s, t) => s + (t.blocks?.length || 0), 0) || 0 }
      } catch { return null }
    }).filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
}

export function deleteProject(id) {
  const p = getProjectPath(id)
  if (existsSync(p)) unlinkSync(p)
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function resolveAudioPath(urlOrPath) {
  if (urlOrPath.startsWith('/api/vocal/audio/')) {
    return resolve(getAudioCacheDir(), basename(urlOrPath))
  }
  if (urlOrPath.startsWith('/api/montage/upload-file/')) {
    return resolve(getUploadsDir(), basename(urlOrPath))
  }
  if (urlOrPath.startsWith('/api/montage/preview-file/')) {
    return resolve(getAudioCacheDir(), 'previews', basename(urlOrPath))
  }
  if (urlOrPath.startsWith('/api/montage/export-file/')) {
    return resolve(getAudioCacheDir(), 'exports', basename(urlOrPath))
  }
  return urlOrPath
}
