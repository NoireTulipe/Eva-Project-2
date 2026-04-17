import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../config/db.js'
import { logError } from '../logs/logger.js'

const router = express.Router()
router.use(authMiddleware)

// Enregistrer ou renouveler un token FCM
router.post('/token', async (req, res) => {
  const { token } = req.body
  if (!token?.trim()) return res.status(400).json({ error: 'Token requis' })
  try {
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: req.user.id },
      create: { token, userId: req.user.id },
    })
    res.status(201).json({ ok: true })
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// Supprimer un token (logout / désabonnement)
router.delete('/token', async (req, res) => {
  const { token } = req.body
  if (!token?.trim()) return res.status(400).json({ error: 'Token requis' })
  try {
    await prisma.deviceToken.deleteMany({ where: { token, userId: req.user.id } })
    res.status(204).end()
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
