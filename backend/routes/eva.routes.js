import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { processMessage } from '../llm/orchestrateur.js'
import prisma from '../config/db.js'
import { logError } from '../logs/logger.js'

const router = Router()

// POST /eva/chat
// Body: { message, conversationId? }
// Si conversationId fourni → charge l'historique depuis la BDD et y sauvegarde l'échange
// Si absent → mode éphémère (compatibilité ascendante)
router.post('/chat', authMiddleware, async (req, res) => {
  const { message, conversationId } = req.body

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message vide' })
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { prenom: true, nom: true }
  })

  // Charger l'historique depuis la BDD si une conversation est fournie
  let history = []
  let conv = null

  if (conversationId) {
    conv = await prisma.conversation.findFirst({
      where: { id: Number(conversationId), userId: req.user.id },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } }
    })
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' })
    history = conv.messages.map(m => ({ role: m.role, content: m.content }))
  }

  const context = {
    userId: req.user.id,
    userName: user?.prenom || user?.nom || 'toi',
    history
  }

  try {
    const response = await processMessage(message.trim(), context)

    // Sauvegarder les messages en BDD si conversation active
    if (conv) {
      await prisma.message.createMany({
        data: [
          { conversationId: conv.id, role: 'user', content: message.trim() },
          { conversationId: conv.id, role: 'assistant', content: response }
        ]
      })

      // Auto-titre : si c'est le premier message, demander un titre court
      const messageCount = conv.messages.length
      if (messageCount === 0 && conv.titre === 'Nouvelle conversation') {
        setAutoTitre(conv.id, message.trim()).catch(() => {})
      } else {
        // Mettre à jour updatedAt
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { updatedAt: new Date() }
        })
      }
    }

    res.json({ response, conversationId: conv?.id ?? null })
  } catch (err) {
    logError(`eva/chat: ${err.message}`)
    res.status(500).json({ error: 'EVA a rencontré une erreur technique. Réessaie dans un instant.' })
  }
})

/**
 * Génère un titre court pour la conversation à partir du premier message.
 * Utilise un appel LLM léger ou un simple raccourcissement.
 */
async function setAutoTitre(conversationId, premierMessage) {
  // Titre simple : premiers 60 caractères du message, tronqué au mot
  let titre = premierMessage.length > 60
    ? premierMessage.slice(0, 60).replace(/\s\S*$/, '') + '…'
    : premierMessage

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { titre, updatedAt: new Date() }
  })
}

export default router
