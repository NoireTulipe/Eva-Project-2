import { Router } from 'express'
import { readFileSync, writeFileSync, existsSync, copyFileSync, statSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcrypt'
import { authMiddleware } from '../middleware/auth.js'
import { invalidatePromptCache } from '../llm/prompts.js'
import { startCron, stopCron, runCronNow, getActiveCrons } from '../crons/cron.manager.js'
import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOGS_DIR = resolve(__dirname, '../logs')

const router = Router()

// Middleware : authentification + rôle admin requis
router.use(authMiddleware)
router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  }
  next()
})

// ─── PROMPTS ──────────────────────────────────────────────────────────────────

// GET /admin/prompts — liste tous les prompts
router.get('/prompts', async (req, res) => {
  const prompts = await prisma.prompt.findMany({ orderBy: [{ module: 'asc' }, { role: 'asc' }] })
  res.json(prompts)
})

// PUT /admin/prompts/:id — modifie un prompt
router.put('/prompts/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { contenu, actif } = req.body

  const prompt = await prisma.prompt.update({
    where: { id },
    data: {
      ...(contenu !== undefined && { contenu }),
      ...(actif !== undefined && { actif })
    }
  })

  invalidatePromptCache()
  logAction(`Admin: prompt ${id} modifié (module=${prompt.module}, role=${prompt.role})`)
  res.json(prompt)
})

// ─── CONFIG LLM ───────────────────────────────────────────────────────────────

// GET /admin/config — liste tous les ConfigParam
router.get('/config', async (req, res) => {
  const params = await prisma.configParam.findMany({ orderBy: { cle: 'asc' } })
  res.json(params)
})

// PUT /admin/config/:id — modifie la valeur d'un ConfigParam
router.put('/config/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { valeur } = req.body

  if (valeur === undefined) {
    return res.status(400).json({ error: 'Champ "valeur" requis' })
  }

  const param = await prisma.configParam.update({
    where: { id },
    data: { valeur }
  })

  logAction(`Admin: config ${param.cle} → ${valeur}`)
  res.json(param)
})

// ─── DISCORD CANAUX ───────────────────────────────────────────────────────────

// GET /admin/discord/canaux — liste tous les canaux
router.get('/discord/canaux', async (req, res) => {
  const canaux = await prisma.canalDiscord.findMany({ orderBy: { nom: 'asc' } })
  res.json(canaux)
})

// POST /admin/discord/canaux — créer un canal
router.post('/discord/canaux', async (req, res) => {
  const { channelId, nom, mode = 'conversation', categories = [] } = req.body

  if (!channelId || !nom) {
    return res.status(400).json({ error: 'channelId et nom requis' })
  }

  const canal = await prisma.canalDiscord.create({
    data: {
      channelId,
      nom,
      mode,
      categories: JSON.stringify(categories)
    }
  })

  logAction(`Admin: canal Discord créé — ${nom} (${channelId})`)
  res.status(201).json(canal)
})

// PUT /admin/discord/canaux/:id — modifier un canal
router.put('/discord/canaux/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { nom, mode, categories, actif } = req.body

  const canal = await prisma.canalDiscord.update({
    where: { id },
    data: {
      ...(nom !== undefined && { nom }),
      ...(mode !== undefined && { mode }),
      ...(categories !== undefined && { categories: JSON.stringify(categories) }),
      ...(actif !== undefined && { actif })
    }
  })

  logAction(`Admin: canal Discord ${id} modifié`)
  res.json(canal)
})

// DELETE /admin/discord/canaux/:id — supprimer un canal
router.delete('/discord/canaux/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  await prisma.canalDiscord.delete({ where: { id } })
  logAction(`Admin: canal Discord ${id} supprimé`)
  res.status(204).end()
})

// ─── LOGS ─────────────────────────────────────────────────────────────────────

// GET /admin/logs?fichier=actions&lignes=200
router.get('/logs', (req, res) => {
  const fichier = req.query.fichier === 'errors' ? 'errors.log' : 'actions.log'
  const nbLignes = Math.min(parseInt(req.query.lignes) || 200, 1000)
  const filePath = resolve(LOGS_DIR, fichier)

  if (!existsSync(filePath)) return res.json({ lignes: [] })

  const content = readFileSync(filePath, 'utf8')
  const lignes = content.trim().split('\n').filter(Boolean)
  res.json({ fichier, lignes: lignes.slice(-nbLignes).reverse() })
})

// DELETE /admin/logs?fichier=actions — vider un log
router.delete('/logs', (req, res) => {
  const fichier = req.query.fichier === 'errors' ? 'errors.log' : 'actions.log'
  const filePath = resolve(LOGS_DIR, fichier)
  if (existsSync(filePath)) {
    writeFileSync(filePath, '', 'utf8')
  }
  logAction(`Admin: log ${fichier} vidé`)
  res.status(204).end()
})

// ─── UTILISATEURS ─────────────────────────────────────────────────────────────

// GET /admin/utilisateurs
router.get('/utilisateurs', async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { nom: 'asc' },
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true, createdAt: true }
  })
  res.json(users)
})

// PUT /admin/utilisateurs/:id
router.put('/utilisateurs/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { nom, prenom, email, role, actif, password } = req.body

  const data = {}
  if (nom !== undefined) data.nom = nom
  if (prenom !== undefined) data.prenom = prenom
  if (email !== undefined) data.email = email
  if (role !== undefined) data.role = role
  if (actif !== undefined) data.actif = actif
  if (password) data.password = await bcrypt.hash(password, 10)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true }
  })

  logAction(`Admin: utilisateur ${id} modifié`)
  res.json(user)
})

// ─── CRONS ────────────────────────────────────────────────────────────────────

// GET /admin/crons
router.get('/crons', async (req, res) => {
  const configs = await prisma.cronConfig.findMany({ orderBy: { nom: 'asc' } })
  const actifs = getActiveCrons()
  res.json(configs.map(c => ({ ...c, enCours: actifs.includes(c.nom) })))
})

// PUT /admin/crons/:id — modifier expression ou actif
router.put('/crons/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { expression, actif } = req.body

  const config = await prisma.cronConfig.update({
    where: { id },
    data: {
      ...(expression !== undefined && { expression }),
      ...(actif !== undefined && { actif })
    }
  })

  if (config.actif) {
    startCron(config)
  } else {
    stopCron(config.nom)
  }

  logAction(`Admin: cron ${config.nom} modifiée`)
  res.json({ ...config, enCours: getActiveCrons().includes(config.nom) })
})

// POST /admin/crons/:id/run — déclenchement manuel
router.post('/crons/:id/run', async (req, res) => {
  const id = parseInt(req.params.id)
  const config = await prisma.cronConfig.findUnique({ where: { id } })
  if (!config) return res.status(404).json({ error: 'Cron introuvable' })

  try {
    await runCronNow(config.nom)
    res.json({ ok: true, message: `Cron "${config.nom}" exécutée` })
  } catch (err) {
    logError(`Admin: exécution manuelle cron ${config.nom} — ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// ─── SAUVEGARDES ──────────────────────────────────────────────────────────────

// GET /admin/sauvegardes/info — infos sur la base SQLite
router.get('/sauvegardes/info', async (req, res) => {
  const dbPath = resolve(__dirname, '../prisma/dev.db')
  if (!existsSync(dbPath)) return res.status(404).json({ error: 'Base introuvable' })

  const stats = statSync(dbPath)
  res.json({
    taille: stats.size,
    tailleMo: (stats.size / 1024 / 1024).toFixed(2),
    modifieLe: stats.mtime
  })
})

// POST /admin/sauvegardes/backup — sauvegarde manuelle
router.post('/sauvegardes/backup', async (req, res) => {
  const dbPath = resolve(__dirname, '../prisma/dev.db')
  if (!existsSync(dbPath)) return res.status(404).json({ error: 'Base introuvable' })

  // Chemin de destination depuis ConfigParam
  const pathParam = await prisma.configParam.findUnique({ where: { cle: 'backup.path' } })
  const destDir = resolve(__dirname, '..', pathParam?.valeur || './prisma/')

  // Créer le dossier si nécessaire
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const fichier = `backup-${ts}.db`
  const backupPath = resolve(destDir, fichier)

  copyFileSync(dbPath, backupPath)
  logAction(`Admin: sauvegarde créée — ${backupPath}`)
  res.json({ ok: true, fichier, chemin: backupPath })
})

// ─── SYSTÈME ──────────────────────────────────────────────────────────────────

// POST /admin/systeme/restart — redémarrage du processus
router.post('/systeme/restart', (req, res) => {
  logAction(`Admin: redémarrage demandé par ${req.user.email}`)
  res.json({ ok: true, message: 'Redémarrage en cours…' })
  // Laisse le temps à la réponse d'être envoyée avant de quitter
  setTimeout(() => process.exit(0), 500)
})

// GET /admin/systeme/status — infos runtime
router.get('/systeme/status', (req, res) => {
  const uptime = process.uptime()
  const h = Math.floor(uptime / 3600)
  const m = Math.floor((uptime % 3600) / 60)
  const s = Math.floor(uptime % 60)

  res.json({
    uptime: `${h}h ${m}m ${s}s`,
    uptimeSecondes: Math.floor(uptime),
    memoire: {
      utilisee: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      totale: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    nodeVersion: process.version,
    pid: process.pid
  })
})

export default router
