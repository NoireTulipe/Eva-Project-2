import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../config/db.js'

const router = Router()
router.use(authMiddleware)

// GET /conversations — liste des conversations de l'utilisateur
router.get('/', async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      titre: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } }
    }
  })
  res.json(conversations)
})

// POST /conversations — créer une nouvelle conversation
router.post('/', async (req, res) => {
  const { titre } = req.body
  const conversation = await prisma.conversation.create({
    data: { userId: req.user.id, titre: titre?.trim() || 'Nouvelle conversation' }
  })
  res.status(201).json(conversation)
})

// GET /conversations/:id — messages d'une conversation
router.get('/:id', async (req, res) => {
  const conv = await prisma.conversation.findFirst({
    where: { id: Number(req.params.id), userId: req.user.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  })
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable' })
  res.json(conv)
})

// PUT /conversations/:id — renommer une conversation
router.put('/:id', async (req, res) => {
  const { titre } = req.body
  if (!titre?.trim()) return res.status(400).json({ error: 'Titre requis' })

  const conv = await prisma.conversation.findFirst({
    where: { id: Number(req.params.id), userId: req.user.id }
  })
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable' })

  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { titre: titre.trim() }
  })
  res.json(updated)
})

// DELETE /conversations/:id — supprimer une conversation (cascade messages)
router.delete('/:id', async (req, res) => {
  const conv = await prisma.conversation.findFirst({
    where: { id: Number(req.params.id), userId: req.user.id }
  })
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable' })

  await prisma.conversation.delete({ where: { id: conv.id } })
  res.status(204).end()
})

export default router
