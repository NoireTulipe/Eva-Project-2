import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.js'
import {
  scrapeAmazon,
  generateShortDescription,
  getWcCategories,
  createWooProduct,
  listWooProducts,
  uploadWPImage
} from '../modules/site/site.service.js'

const router = Router()
router.use(authMiddleware)

// Multer en mémoire pour l'upload d'images (pas de disque local)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 Mo max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Seules les images sont acceptées.'))
  }
})

// POST /api/site/scrape
router.post('/scrape', async (req, res) => {
  const { url } = req.body
  if (!url || !url.includes('amazon')) {
    return res.status(400).json({ error: 'URL Amazon valide requise.' })
  }
  try {
    res.json(await scrapeAmazon(url))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/generer-accroche
router.post('/generer-accroche', async (req, res) => {
  const { description } = req.body
  if (!description?.trim()) return res.status(400).json({ error: 'Description requise.' })
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

// POST /api/site/media
// Upload une image supplémentaire vers la médiathèque WP
// Corps : multipart/form-data avec champ "image" + champs optionnels altText, title, caption
router.post('/media', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' })
  try {
    const ext = req.file.originalname.split('.').pop().toLowerCase() || 'jpg'
    const filename = req.body.filename
      ? `${req.body.filename}.${ext}`
      : req.file.originalname

    const metadata = {
      altText:     req.body.altText     || '',
      title:       req.body.title       || '',
      caption:     req.body.caption     || '',
      description: req.body.description || ''
    }

    const media = await uploadWPImage(req.file.buffer, filename, metadata)
    res.json(media) // { id, src }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/produit
router.post('/produit', async (req, res) => {
  const { bookData, options } = req.body
  if (!bookData?.title) return res.status(400).json({ error: 'bookData avec un titre requis.' })
  try {
    res.json(await createWooProduct(bookData, options || {}))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/site/produits
router.get('/produits', async (req, res) => {
  const limit  = parseInt(req.query.limit)  || 20
  const status = req.query.status || 'any'
  try {
    res.json(await listWooProducts({ limit, status }))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
