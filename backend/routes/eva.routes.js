import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { processMessage } from '../llm/orchestrateur.js'
import prisma from '../config/db.js'
import { logError } from '../logs/logger.js'

const router = Router()

// POST /eva/chat
router.post('/chat', authMiddleware, async (req, res) => {
  const { message, history = [] } = req.body

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message vide' })
  }

  // Récupérer le prénom de l'utilisateur pour personnaliser les réponses
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { prenom: true, nom: true }
  })

  const context = {
    userId: req.user.id,
    userName: user?.prenom || user?.nom || 'toi',
    history: Array.isArray(history) ? history.slice(-10) : []
  }

  try {
    const response = await processMessage(message.trim(), context)
    res.json({ response })
  } catch (err) {
    logError(`eva/chat: ${err.message}`)
    res.status(500).json({ error: 'EVA a rencontré une erreur technique. Réessaie dans un instant.' })
  }
})

export default router
