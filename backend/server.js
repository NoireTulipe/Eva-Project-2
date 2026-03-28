import express from 'express'
import dotenv from 'dotenv'
import { logError, logAction } from './logs/logger.js'
import { loggerMiddleware } from './middleware/logger.js'
import authRoutes from './routes/auth.routes.js'
import ventesRoutes from './routes/ventes.routes.js'
import referentielsRoutes from './routes/referentiels.routes.js'

dotenv.config({ path: '../.env' })

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(loggerMiddleware)

// Routes
app.use('/auth', authRoutes)
app.use('/ventes', ventesRoutes)
app.use('/ref', referentielsRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Erreurs globales
app.use((err, req, res, next) => {
  logError(err.message)
  res.status(500).json({ error: 'Erreur interne du serveur' })
})

app.listen(PORT, () => {
  logAction(`EVA backend démarré sur le port ${PORT}`)
})