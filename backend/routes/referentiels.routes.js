import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../config/db.js'
import { logError } from '../logs/logger.js'

const router = express.Router()
router.use(authMiddleware)

// Tables autorisées et leur modèle Prisma correspondant
const TABLES = {
  categories:     'categorie',
  'types-pdv':    'typePDV',
  'types-frais':  'typeFrais',
  'types-perte':  'typePerte',
  'types-hors-stock': 'typeHorsStock',
  'methodes-paiement': 'methodePaiement',
  'types-contact': 'typeContact',
}

function getModel(table) {
  const model = TABLES[table]
  if (!model) return null
  return prisma[model]
}

// GET /ref/:table — liste triée par nom
router.get('/:table', async (req, res) => {
  const model = getModel(req.params.table)
  if (!model) return res.status(404).json({ error: 'Table inconnue' })
  try {
    res.json(await model.findMany({ orderBy: { nom: 'asc' } }))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /ref/:table — créer une entrée { nom }
router.post('/:table', async (req, res) => {
  const model = getModel(req.params.table)
  if (!model) return res.status(404).json({ error: 'Table inconnue' })
  const { nom } = req.body
  if (!nom?.trim()) return res.status(400).json({ error: 'Le champ nom est requis' })
  try {
    const entry = await model.create({ data: { nom: nom.trim() } })
    res.status(201).json(entry)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: `"${nom}" existe déjà` })
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// PUT /ref/:table/:id — renommer
router.put('/:table/:id', async (req, res) => {
  const model = getModel(req.params.table)
  if (!model) return res.status(404).json({ error: 'Table inconnue' })
  const { nom } = req.body
  if (!nom?.trim()) return res.status(400).json({ error: 'Le champ nom est requis' })
  try {
    const entry = await model.update({
      where: { id: Number(req.params.id) },
      data: { nom: nom.trim() }
    })
    res.json(entry)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Entrée introuvable' })
    if (err.code === 'P2002') return res.status(409).json({ error: `"${nom}" existe déjà` })
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /ref/:table/:id — supprimer
router.delete('/:table/:id', async (req, res) => {
  const model = getModel(req.params.table)
  if (!model) return res.status(404).json({ error: 'Table inconnue' })
  try {
    await model.delete({ where: { id: Number(req.params.id) } })
    res.status(204).end()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Entrée introuvable' })
    if (err.code === 'P2003') return res.status(409).json({ error: 'Entrée utilisée, impossible de supprimer' })
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
