import express from 'express'
import multer from 'multer'
import { resolve, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, unlinkSync, existsSync } from 'fs'
import { authMiddleware } from '../middleware/auth.js'
import {
  getProduits,
  getProduitById,
  createProduit,
  updateProduit,
  deleteProduit,
  updateImageProduit,
  getEtatStock,
  getPointsDeVente,
  createPointDeVente,
  updatePointDeVente,
  ouvrirSession,
  cloturerSession,
  supprimerSession,
  rouvrirSession,
  getSessionById,
  getSessions,
  enregistrerVente,
  annulerVente,
  getFrais,
  ajouterFraisSession,
  ajouterFraisLibre,
  supprimerFrais,
  getPertes,
  creerPerte,
  supprimerPerte,
  getAuteurs,
  creerAuteur,
  updateAuteur,
  supprimerAuteur,
  setAuteursProduit,
  getDepots,
  creerDepot,
  retourDepot,
  getRecapCompta,
} from '../modules/ventes/ventes.service.js'
import { logError } from '../logs/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = resolve(__dirname, '../uploads/produits')
mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `produit-${req.params.id}-${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|png|webp)/.test(file.mimetype)) cb(null, true)
    else cb(new Error('Format non supporté (jpg, png, webp uniquement)'))
  },
})

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

router.post('/produits/:id/image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' })
  try {
    const id = Number(req.params.id)
    const produit = await getProduitById(id)
    if (!produit) return res.status(404).json({ error: 'Produit introuvable' })
    // Supprimer l'ancienne image si elle existe
    if (produit.imageUrl) {
      const oldPath = resolve(__dirname, '../', produit.imageUrl.replace(/^\//, ''))
      if (existsSync(oldPath)) unlinkSync(oldPath)
    }
    const imageUrl = `/uploads/produits/${req.file.filename}`
    const updated = await updateImageProduit(id, imageUrl)
    res.json(updated)
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/produits/:id/image', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const produit = await getProduitById(id)
    if (!produit) return res.status(404).json({ error: 'Produit introuvable' })
    if (produit.imageUrl) {
      const filePath = resolve(__dirname, '../', produit.imageUrl.replace(/^\//, ''))
      if (existsSync(filePath)) unlinkSync(filePath)
    }
    const updated = await updateImageProduit(id, null)
    res.json(updated)
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

router.post('/sessions/:id/rouvrir', async (req, res) => {
  try {
    await rouvrirSession(Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    logError(err.message)
    res.status(400).json({ error: err.message })
  }
})

router.delete('/sessions/:id', async (req, res) => {
  try {
    await supprimerSession(Number(req.params.id))
    res.sendStatus(204)
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

// ─── FRAIS ────────────────────────────────────────────────────────────────────

router.get('/frais', async (req, res) => {
  try {
    res.json(await getFrais({ debut: req.query.debut, fin: req.query.fin }))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/frais', async (req, res) => {
  const { typeFraisId, libelle, montant } = req.body
  if (!typeFraisId) return res.status(400).json({ error: 'Le type de frais est requis' })
  if (!libelle?.trim()) return res.status(400).json({ error: 'Le libellé est requis' })
  if (montant == null) return res.status(400).json({ error: 'Le montant est requis' })
  try {
    res.status(201).json(await ajouterFraisLibre(req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/sessions/:id/frais', async (req, res) => {
  const { typeFraisId, libelle, montant } = req.body
  if (!typeFraisId) return res.status(400).json({ error: 'Le type de frais est requis' })
  if (!libelle?.trim()) return res.status(400).json({ error: 'Le libellé est requis' })
  if (montant == null) return res.status(400).json({ error: 'Le montant est requis' })
  try {
    res.status(201).json(await ajouterFraisSession(Number(req.params.id), req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/frais/:id', async (req, res) => {
  try {
    await supprimerFrais(Number(req.params.id))
    res.status(204).end()
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── PERTES ───────────────────────────────────────────────────────────────────

router.get('/pertes', async (req, res) => {
  try {
    res.json(await getPertes({ debut: req.query.debut, fin: req.query.fin }))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/pertes', async (req, res) => {
  const { typePerteid, valeur } = req.body
  if (!typePerteid) return res.status(400).json({ error: 'Le type de perte est requis' })
  if (valeur == null) return res.status(400).json({ error: 'La valeur est requise' })
  try {
    res.status(201).json(await creerPerte(req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/pertes/:id', async (req, res) => {
  try {
    await supprimerPerte(Number(req.params.id))
    res.status(204).end()
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── AUTEURS ──────────────────────────────────────────────────────────────────

router.get('/auteurs', async (_req, res) => {
  try {
    res.json(await getAuteurs())
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/auteurs', async (req, res) => {
  if (!req.body.nom?.trim()) return res.status(400).json({ error: 'Le nom est requis' })
  try {
    res.status(201).json(await creerAuteur(req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.put('/auteurs/:id', async (req, res) => {
  if (!req.body.nom?.trim()) return res.status(400).json({ error: 'Le nom est requis' })
  try {
    res.json(await updateAuteur(Number(req.params.id), req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/auteurs/:id', async (req, res) => {
  try {
    await supprimerAuteur(Number(req.params.id))
    res.status(204).end()
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.put('/produits/:id/auteurs', async (req, res) => {
  const { auteurIds } = req.body
  if (!Array.isArray(auteurIds)) return res.status(400).json({ error: 'auteurIds doit être un tableau' })
  try {
    res.json(await setAuteursProduit(Number(req.params.id), auteurIds))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── DÉPÔTS ───────────────────────────────────────────────────────────────────

router.get('/depots', async (req, res) => {
  try {
    const pdvId = req.query.pdvId ? Number(req.query.pdvId) : undefined
    res.json(await getDepots({ pdvId }))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/depots', async (req, res) => {
  const { produitId, pointDeVenteId, quantite } = req.body
  if (!produitId) return res.status(400).json({ error: 'Le produit est requis' })
  if (!pointDeVenteId) return res.status(400).json({ error: 'Le point de vente est requis' })
  if (!quantite || quantite <= 0) return res.status(400).json({ error: 'La quantité doit être positive' })
  try {
    res.status(201).json(await creerDepot(req.body))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/depots/:id/retour', async (req, res) => {
  const { quantite } = req.body
  if (!quantite || quantite <= 0) return res.status(400).json({ error: 'La quantité de retour doit être positive' })
  try {
    res.json(await retourDepot(Number(req.params.id), Number(quantite)))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── COMPTABILITÉ ─────────────────────────────────────────────────────────────

router.get('/compta', async (req, res) => {
  try {
    res.json(await getRecapCompta({ debut: req.query.debut, fin: req.query.fin }))
  } catch (err) {
    logError(err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router