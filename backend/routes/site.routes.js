import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.js'
import {
  scrapeAmazon,
  generateShortDescription,
  getWcCategories,
  createWooProduct,
  listWooProducts,
  listWooProductsLite,
  uploadWPImage,
  getNewsPrompt,
  saveNewsPrompt,
  generateArticle,
  publishWPArticle,
  getShippingZonesWithMethods,
  addShippingMethod,
  updateShippingMethod,
  deleteShippingMethod,
  getShippingClasses,
  seedShipping,
  setProductsShippingClass
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

// GET  /api/site/news-prompt
router.get('/news-prompt', async (req, res) => {
  try {
    res.json({ prompt: await getNewsPrompt() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT  /api/site/news-prompt
router.put('/news-prompt', async (req, res) => {
  const { prompt } = req.body
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt vide.' })
  try {
    await saveNewsPrompt(prompt.trim())
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/article/generer
// Corps : { generalPrompt, instruction }
router.post('/article/generer', async (req, res) => {
  const { generalPrompt, instruction } = req.body
  if (!instruction?.trim()) return res.status(400).json({ error: 'Instruction requise.' })
  if (!generalPrompt?.trim()) return res.status(400).json({ error: 'Prompt général requis.' })
  try {
    res.json(await generateArticle(generalPrompt, instruction))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/article
// Corps : { title, content, date, status, featuredMediaId }
router.post('/article', async (req, res) => {
  const { title, content, date, status, featuredMediaId } = req.body
  if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'Titre et contenu requis.' })
  try {
    res.json(await publishWPArticle({ title, content, date, status, featuredMediaId }))
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

// ─── Livraison — Zones & méthodes ────────────────────────────────────────────

// GET /api/site/shipping — zones + méthodes
router.get('/shipping', async (req, res) => {
  try {
    res.json(await getShippingZonesWithMethods())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/site/shipping/classes — classes d'expédition (tranches de poids)
router.get('/shipping/classes', async (req, res) => {
  try {
    res.json(await getShippingClasses())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/shipping/seed — initialise les tarifs La Poste
router.post('/shipping/seed', async (req, res) => {
  try {
    res.json(await seedShipping())
  } catch (e) {
    const status = e.message.includes('existe déjà') ? 409 : 500
    res.status(status).json({ error: e.message })
  }
})

// PUT /api/site/shipping/products — affecte une classe d'expédition à des produits
router.put('/shipping/products', async (req, res) => {
  const { productIds, classSlug } = req.body
  if (!classSlug) return res.status(400).json({ error: 'classSlug requis.' })
  if (!productIds) return res.status(400).json({ error: 'productIds requis (tableau ou "all").' })
  try {
    res.json(await setProductsShippingClass(productIds, classSlug))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/site/shipping/:zoneId/methods — ajouter une méthode à une zone
router.post('/shipping/:zoneId/methods', async (req, res) => {
  const { methodId } = req.body
  if (!methodId) return res.status(400).json({ error: 'methodId requis.' })
  try {
    res.json(await addShippingMethod(req.params.zoneId, methodId))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/site/shipping/:zoneId/methods/:instanceId — modifier une méthode
router.put('/shipping/:zoneId/methods/:instanceId', async (req, res) => {
  try {
    res.json(await updateShippingMethod(req.params.zoneId, req.params.instanceId, req.body))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/site/shipping/:zoneId/methods/:instanceId — supprimer une méthode
router.delete('/shipping/:zoneId/methods/:instanceId', async (req, res) => {
  try {
    await deleteShippingMethod(req.params.zoneId, req.params.instanceId)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/site/produits-lite — liste légère pour combobox (id + nom + classe)
router.get('/produits-lite', async (req, res) => {
  try {
    res.json(await listWooProductsLite())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
