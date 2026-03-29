import express from 'express'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { logError, logAction } from './logs/logger.js'
import { loggerMiddleware } from './middleware/logger.js'
import authRoutes from './routes/auth.routes.js'
import ventesRoutes from './routes/ventes.routes.js'
import referentielsRoutes from './routes/referentiels.routes.js'
import evaRoutes from './routes/eva.routes.js'
import adminRoutes from './routes/admin.routes.js'
import { startBot } from './discord/bot.js'
import { startAllCrons } from './crons/cron.manager.js'
import prisma from './config/db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const FRONTEND_DIST = resolve(__dirname, '../frontend/dist')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(loggerMiddleware)

// Servir le frontend buildé (production)
if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST))
}

// Routes
app.use('/auth', authRoutes)
app.use('/ventes', ventesRoutes)
app.use('/ref', referentielsRoutes)
app.use('/eva', evaRoutes)
app.use('/admin', adminRoutes)

// Health check
app.get('/health', (req, res) => {
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

  // Démarrer le bot Discord si activé
  const discordParam = await prisma.configParam.findUnique({ where: { cle: 'discord.enabled' } })
  if (discordParam?.valeur === 'true') {
    startBot().catch(err => logAction(`Discord: échec démarrage — ${err.message}`))
  }
})