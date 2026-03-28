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