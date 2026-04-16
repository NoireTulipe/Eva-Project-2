import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../config/db.js'
import { logError } from '../logs/logger.js'

const router = Router()

// GET /api/notes — toutes les notes (non expirées)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: {
        OR: [
          { expirationAt: null },
          { expirationAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(notes)
  } catch (err) {
    logError(`GET /notes : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/notes — créer une note
router.post('/', authMiddleware, async (req, res) => {
  const { contenu, couleurFond, couleurTexte, rappelAt, expirationAt } = req.body
  if (!contenu?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  try {
    const note = await prisma.note.create({
      data: {
        contenu: contenu.trim(),
        couleurFond: couleurFond || '#fef08a',
        couleurTexte: couleurTexte || '#1f2937',
        rappelAt: rappelAt ? new Date(rappelAt) : null,
        expirationAt: expirationAt ? new Date(expirationAt) : null
      }
    })
    res.status(201).json(note)
  } catch (err) {
    logError(`POST /notes : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PUT /api/notes/:id — modifier une note
router.put('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id)
  const { contenu, couleurFond, couleurTexte, rappelAt, expirationAt } = req.body
  try {
    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(contenu !== undefined && { contenu: contenu.trim() }),
        ...(couleurFond !== undefined && { couleurFond }),
        ...(couleurTexte !== undefined && { couleurTexte }),
        rappelAt: rappelAt !== undefined ? (rappelAt ? new Date(rappelAt) : null) : undefined,
        rappelEnvoye: rappelAt !== undefined ? false : undefined, // reset si on change le rappel
        expirationAt: expirationAt !== undefined ? (expirationAt ? new Date(expirationAt) : null) : undefined
      }
    })
    res.json(note)
  } catch (err) {
    logError(`PUT /notes/${id} : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/notes/:id — supprimer une note
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.note.delete({ where: { id } })
    res.status(204).end()
  } catch (err) {
    logError(`DELETE /notes/${id} : ${err.message}`)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
