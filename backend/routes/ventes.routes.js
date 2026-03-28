import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import {
  getProduits,
  getProduitById,
  createProduit,
  updateProduit,
  deleteProduit,
  getEtatStock,
  getPointsDeVente,
  createPointDeVente,
  updatePointDeVente,
  ouvrirSession,
  cloturerSession,
  getSessionById,
  getSessions,
  enregistrerVente,
  annulerVente,
} from '../modules/ventes/ventes.service.js'
import { logError } from '../logs/logger.js'

const router = express.Router()
router.use(authMiddleware)

// ─── PRODUITS ─────────────────────────────────────────────────────────────────

router.get('/produits', async (req, res) => {
  try {
    res.json(await getProduits())
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.get('/produits/:id', async (req, res) => {
  try {
    const produit = await getProduitById(Number(req.params.id))
    if (!produit) return res.status(404).json({ error: 'Produit introuvable' })
    res.json(produit)
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.get('/produits/:id/stock', async (req, res) => {
  try {
    res.json(await getEtatStock(Number(req.params.id)))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/produits', async (req, res) => {
  const { nom, categorieId, prixVenteTTC, stock } = req.body
  if (!nom?.trim()) return res.status(400).json({ error: 'Le nom est requis' })
  if (!categorieId) return res.status(400).json({ error: 'La catégorie est requise' })
  if (prixVenteTTC == null) return res.status(400).json({ error: 'Le prix TTC est requis' })
  if (stock == null) return res.status(400).json({ error: 'Le stock est requis' })
  try {
    res.status(201).json(await createProduit(req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.put('/produits/:id', async (req, res) => {
  try {
    res.json(await updateProduit(Number(req.params.id), req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/produits/:id', async (req, res) => {
  try {
    res.json(await deleteProduit(Number(req.params.id)))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── POINTS DE VENTE ──────────────────────────────────────────────────────────

router.get('/pdv', async (req, res) => {
  try {
    res.json(await getPointsDeVente())
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/pdv', async (req, res) => {
  if (!req.body.nom?.trim()) return res.status(400).json({ error: 'Le nom est requis' })
  try {
    res.status(201).json(await createPointDeVente(req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.put('/pdv/:id', async (req, res) => {
  try {
    res.json(await updatePointDeVente(Number(req.params.id), req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

router.get('/sessions', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const offset = req.query.offset ? Number(req.query.offset) : 0
    res.json(await getSessions({ limit, offset }))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/sessions', async (req, res) => {
  try {
    const { pointDeVenteId, debut } = req.body
    res.status(201).json(await ouvrirSession(pointDeVenteId, debut))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await getSessionById(Number(req.params.id))
    if (!session) return res.status(404).json({ error: 'Session introuvable' })
    res.json(session)
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/sessions/:id/cloturer', async (req, res) => {
  try {
    res.json(await cloturerSession(Number(req.params.id)))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── VENTES ───────────────────────────────────────────────────────────────────

router.post('/ventes', async (req, res) => {
  const { sessionId, methodePaiementId, lignes } = req.body
  if (!sessionId) return res.status(400).json({ error: 'La session est requise' })
  if (!methodePaiementId) return res.status(400).json({ error: 'La méthode de paiement est requise' })
  if (!Array.isArray(lignes) || lignes.length === 0) return res.status(400).json({ error: 'Au moins une ligne de vente est requise' })
  try {
    res.status(201).json(await enregistrerVente(req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/ventes/:id/annuler', async (req, res) => {
  try {
    res.json(await annulerVente(Number(req.params.id)))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router