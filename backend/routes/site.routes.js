import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import {
  fetchFromGoogleBooks,
  scrapeAmazon,
  createWooProduct,
  listWooProducts
} from '../modules/site/site.service.js'

const router = Router()
router.use(authMiddleware)

// POST /api/site/isbn
// Corps : { query: "978-..." ou "Titre du livre" }
// Retourne : un objet bookData (si ISBN) ou un tableau de résultats (si titre)
router.post('/isbn', async (req, res) => {
  const { query } = req.body
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Paramètre query requis.' })
  }
  try {
    const result = await fetchFromGoogleBooks(query.trim())
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/scrape
// Corps : { url: "https://www.amazon.fr/dp/..." }
// Retourne : objet bookData normalisé
router.post('/scrape', async (req, res) => {
  const { url } = req.body
  if (!url || !url.includes('amazon')) {
    return res.status(400).json({ error: 'URL Amazon valide requise.' })
  }
  try {
    const result = await scrapeAmazon(url)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/produit
// Corps : { bookData: {...}, options: { price, stock, genre, autoPublish, shortDescription } }
// Retourne : { id, name, permalink, status, editUrl }
router.post('/produit', async (req, res) => {
  const { bookData, options } = req.body
  if (!bookData || !bookData.title) {
    return res.status(400).json({ error: 'bookData avec un titre requis.' })
  }
  try {
    const result = await createWooProduct(bookData, options || {})
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/site/produits
// Query : ?limit=20&status=any
router.get('/produits', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20
  const status = req.query.status || 'any'
  try {
    const products = await listWooProducts({ limit, status })
    res.json(products)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
