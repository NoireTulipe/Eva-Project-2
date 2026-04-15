import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import {
  scrapeAmazon,
  generateShortDescription,
  getWcCategories,
  createWooProduct,
  listWooProducts
} from '../modules/site/site.service.js'

const router = Router()
router.use(authMiddleware)

// POST /api/site/scrape
// Corps : { url: "https://www.amazon.fr/dp/..." }
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

// POST /api/site/generer-accroche
// Corps : { description: "..." }
router.post('/generer-accroche', async (req, res) => {
  const { description } = req.body
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description requise.' })
  }
  try {
    const accroche = await generateShortDescription(description.trim())
    res.json({ accroche })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/site/categories
router.get('/categories', async (req, res) => {
  try {
    const cats = await getWcCategories()
    res.json(cats.map(c => ({ id: c.id, name: c.name, slug: c.slug, count: c.count })))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/produit
// Corps : { bookData: {...}, options: { price, categoryIds, impression, autoPublish, shortDescription, upsellIds } }
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
  const limit  = parseInt(req.query.limit)  || 20
  const status = req.query.status || 'any'
  try {
    const products = await listWooProducts({ limit, status })
    res.json(products)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
