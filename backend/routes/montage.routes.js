import { Router } from 'express'
import { existsSync, createReadStream, statSync } from 'fs'
import { resolve, basename, extname } from 'path'
import multer from 'multer'
import crypto from 'crypto'
import { authMiddleware } from '../middleware/auth.js'
import { logError, logAction } from '../logs/logger.js'
import { getUploadsDir, trimPreview, exportMontage, listSources, saveProject, loadProject, listProjects, deleteProject } from '../modules/vocal/montage.service.js'
import { getAudioCacheDir } from '../modules/vocal/tts.service.js'

const router = Router()

// Multer pour les uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getUploadsDir()),
  filename: (req, file, cb) => {
    const ext = file.originalname.replace(/^.*\./, '')
    cb(null, `${crypto.randomBytes(6).toString('hex')}.${ext}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// ─── GET /api/montage/sources ────────────────────────────────────────────────

router.get('/sources', authMiddleware, async (req, res) => {
  try {
    const sources = await listSources()
    res.json(sources)
  } catch (err) {
    logError(`GET /montage/sources : ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /api/montage/upload ────────────────────────────────────────────────

router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier requis' })
  const url = `/api/montage/upload-file/${req.file.filename}`
  res.json({ name: req.file.originalname, file: url, size: req.file.size })
})

// ─── GET /api/montage/upload-file/:name ──────────────────────────────────────

router.get('/upload-file/:name', (req, res) => {
  const filePath = resolve(getUploadsDir(), basename(req.params.name))
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Fichier introuvable' })
  res.setHeader('Content-Type', extname(filePath) === '.mp3' ? 'audio/mpeg' : 'audio/wav')
  createReadStream(filePath).pipe(res)
})

// ─── POST /api/montage/preview ───────────────────────────────────────────────

router.post('/preview', authMiddleware, async (req, res) => {
  try {
    const { file, position } = req.body
    const audioDir = getAudioCacheDir()
    // Résoudre le chemin selon le type d'URL
    let filePath
    if (file.startsWith('/api/vocal/audio/')) filePath = resolve(audioDir, basename(file))
    else if (file.startsWith('/api/montage/upload-file/')) filePath = resolve(getUploadsDir(), basename(file))
    else return res.status(400).json({ error: 'Type de fichier non supporté' })

    const result = await trimPreview(filePath, position || 0)
    res.json(result)
  } catch (err) {
    logError(`POST /montage/preview : ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/montage/preview-file/:name ─────────────────────────────────────

router.get('/preview-file/:name', (req, res) => {
  const previewDir = resolve(getAudioCacheDir(), 'previews')
  const filePath = resolve(previewDir, basename(req.params.name))
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Preview introuvable' })
  res.setHeader('Content-Type', 'audio/mpeg')
  createReadStream(filePath).pipe(res)
})

// ─── POST /api/montage/export ────────────────────────────────────────────────

router.post('/export', authMiddleware, async (req, res) => {
  try {
    const result = await exportMontage(req.body)
    res.json(result)
  } catch (err) {
    logError(`POST /montage/export : ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/montage/export-file/:name ──────────────────────────────────────

router.get('/export-file/:name', (req, res) => {
  const exportsDir = resolve(getAudioCacheDir(), 'exports')
  const filePath = resolve(exportsDir, basename(req.params.name))
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Export introuvable' })
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}"`)
  createReadStream(filePath).pipe(res)
})

// ─── CRUD Projets ────────────────────────────────────────────────────────────

router.get('/projects', authMiddleware, (req, res) => {
  try { res.json(listProjects()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/projects/:id', authMiddleware, (req, res) => {
  try { res.json(loadProject(req.params.id)) }
  catch (err) { res.status(404).json({ error: err.message }) }
})

router.post('/projects/:id', authMiddleware, (req, res) => {
  try {
    const project = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() }
    saveProject(req.params.id, project)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/projects/:id', authMiddleware, (req, res) => {
  try { deleteProject(req.params.id); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
