import express from 'express'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { logError, logAction } from './logs/logger.js'
import { thumbMiddleware } from './modules/ventes/thumb.js'
import { loggerMiddleware } from './middleware/logger.js'
import authRoutes from './routes/auth.routes.js'
import ventesRoutes from './routes/ventes.routes.js'
import referentielsRoutes from './routes/referentiels.routes.js'
import evaRoutes from './routes/eva.routes.js'
import conversationsRoutes from './routes/conversations.routes.js'
import memoireRoutes from './routes/memoire.routes.js'
import adminRoutes from './routes/admin.routes.js'
import mailRoutes from './routes/mail.routes.js'
import instagramRoutes, { webhookRouter as instagramWebhookRouter } from './routes/instagram.routes.js'
import { startBot } from './discord/bot.js'
import { startAllCrons } from './crons/cron.manager.js'
import { startInstagramPlanifCron } from './crons/instagram-planif.cron.js'
import prisma from './config/db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const FRONTEND_DIST = resolve(__dirname, '../frontend/dist')

const app = express()
const PORT = process.env.PORT || 3000

// CORS — autorise le web local, l'app Capacitor Android et les origines nulles (fichier local)

app.use((req, res, next) => {
  const origin = req.headers.origin
  // Toujours autoriser — EVA est une app privée, pas exposée publiquement
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Webhook Instagram — AVANT express.json() pour que express.raw() fonctionne
app.use('/api/instagram', instagramWebhookRouter)

app.use(express.json())
app.use(loggerMiddleware)

// Thumbnails — lazy-resize via sharp, cachés 30 jours
app.get('/uploads/thumb/:filename', thumbMiddleware)

// Servir les uploads produits (images) — sans auth, cachés 30 jours
app.use('/uploads', express.static(resolve(__dirname, 'uploads'), {
  maxAge: '30d',
  immutable: true,
}))

// Servir le frontend buildé (production)
if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST))
}

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/ventes', ventesRoutes)
app.use('/api/ref', referentielsRoutes)
app.use('/api/eva', evaRoutes)
app.use('/api/conversations', conversationsRoutes)
app.use('/api/memoire', memoireRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/mail', mailRoutes)
app.use('/api/instagram', instagramRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Fallback SPA — toutes les routes non-API → index.html
if (existsSync(FRONTEND_DIST)) {
  app.get('*', (req, res) => {
    res.sendFile(resolve(FRONTEND_DIST, 'index.html'))
  })
}

// Erreurs globales
app.use((err, req, res, next) => {
  logError(err.message)
  res.status(500).json({ error: 'Erreur interne du serveur' })
})

app.listen(PORT, async () => {
  logAction(`EVA backend démarré sur le port ${PORT}`)
  logAction(`Frontend dist : ${FRONTEND_DIST} — ${existsSync(FRONTEND_DIST) ? 'TROUVÉ' : 'INTROUVABLE'}`)

  // Démarrer les crons
  startAllCrons().catch(err => logError(`Crons: échec démarrage — ${err.message}`))
  startInstagramPlanifCron()

  // Démarrer le bot Discord si activé
  const discordParam = await prisma.configParam.findUnique({ where: { cle: 'discord.enabled' } })
  if (discordParam?.valeur === 'true') {
    startBot().catch(err => logAction(`Discord: échec démarrage — ${err.message}`))
  }
})