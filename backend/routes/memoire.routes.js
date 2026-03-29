import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../config/db.js'
import { embed, serializeVector } from '../modules/memoire/embeddings.js'
import { rechercheMemoire } from '../modules/memoire/recherche.js'
import { consolidateUser } from '../modules/memoire/consolidation.js'
import { logError } from '../logs/logger.js'

const router = Router()
router.use(authMiddleware)

const uid = (req) => req.user.id

// ─── SOUVENIRS ────────────────────────────────────────────────────────────────

router.get('/souvenirs', async (req, res) => {
  const items = await prisma.memSouvenir.findMany({
    where: { userId: uid(req) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, contenu: true, createdAt: true, updatedAt: true }
  })
  res.json(items)
})

router.post('/souvenirs', async (req, res) => {
  const { contenu } = req.body
  if (!contenu?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const item = await prisma.memSouvenir.create({
    data: { userId: uid(req), contenu: contenu.trim(), embedding }
  })
  res.status(201).json({ id: item.id, contenu: item.contenu, createdAt: item.createdAt })
})

router.put('/souvenirs/:id', async (req, res) => {
  const { contenu } = req.body
  if (!contenu?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  const item = await prisma.memSouvenir.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const updated = await prisma.memSouvenir.update({
    where: { id: item.id },
    data: { contenu: contenu.trim(), embedding },
    select: { id: true, contenu: true, createdAt: true, updatedAt: true }
  })
  res.json(updated)
})

router.delete('/souvenirs/:id', async (req, res) => {
  const item = await prisma.memSouvenir.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  await prisma.memSouvenir.delete({ where: { id: item.id } })
  res.status(204).end()
})

// ─── PRÉFÉRENCES ──────────────────────────────────────────────────────────────

router.get('/preferences', async (req, res) => {
  const items = await prisma.memPreference.findMany({
    where: { userId: uid(req) },
    orderBy: { cle: 'asc' },
    select: { id: true, cle: true, contenu: true, createdAt: true, updatedAt: true }
  })
  res.json(items)
})

router.post('/preferences', async (req, res) => {
  const { cle, contenu } = req.body
  if (!cle?.trim() || !contenu?.trim()) return res.status(400).json({ error: 'Clé et contenu requis' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const item = await prisma.memPreference.create({
    data: { userId: uid(req), cle: cle.trim(), contenu: contenu.trim(), embedding }
  })
  res.status(201).json({ id: item.id, cle: item.cle, contenu: item.contenu, createdAt: item.createdAt })
})

router.put('/preferences/:id', async (req, res) => {
  const { cle, contenu } = req.body
  if (!contenu?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  const item = await prisma.memPreference.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const updated = await prisma.memPreference.update({
    where: { id: item.id },
    data: {
      cle: cle?.trim() || item.cle,
      contenu: contenu.trim(),
      embedding
    },
    select: { id: true, cle: true, contenu: true, createdAt: true, updatedAt: true }
  })
  res.json(updated)
})

router.delete('/preferences/:id', async (req, res) => {
  const item = await prisma.memPreference.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  await prisma.memPreference.delete({ where: { id: item.id } })
  res.status(204).end()
})

// ─── CONTACTS ─────────────────────────────────────────────────────────────────

router.get('/contacts', async (req, res) => {
  const items = await prisma.memContact.findMany({
    where: { userId: uid(req) },
    orderBy: { nom: 'asc' },
    select: { id: true, nom: true, contenu: true, createdAt: true, updatedAt: true }
  })
  res.json(items)
})

router.post('/contacts', async (req, res) => {
  const { nom, contenu } = req.body
  if (!nom?.trim() || !contenu?.trim()) return res.status(400).json({ error: 'Nom et contenu requis' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const item = await prisma.memContact.create({
    data: { userId: uid(req), nom: nom.trim(), contenu: contenu.trim(), embedding }
  })
  res.status(201).json({ id: item.id, nom: item.nom, contenu: item.contenu, createdAt: item.createdAt })
})

router.put('/contacts/:id', async (req, res) => {
  const { nom, contenu } = req.body
  if (!contenu?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  const item = await prisma.memContact.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const updated = await prisma.memContact.update({
    where: { id: item.id },
    data: {
      nom: nom?.trim() || item.nom,
      contenu: contenu.trim(),
      embedding
    },
    select: { id: true, nom: true, contenu: true, createdAt: true, updatedAt: true }
  })
  res.json(updated)
})

router.delete('/contacts/:id', async (req, res) => {
  const item = await prisma.memContact.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  await prisma.memContact.delete({ where: { id: item.id } })
  res.status(204).end()
})

// ─── BUFFER ───────────────────────────────────────────────────────────────────

router.get('/buffer', async (req, res) => {
  const { traite } = req.query
  const where = { source: { contains: String(uid(req)) } }
  if (traite === 'true') where.traite = true
  else if (traite === 'false') where.traite = false

  const items = await prisma.memBuffer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, source: true, contenu: true, traite: true, createdAt: true }
  })
  res.json(items)
})

router.delete('/buffer/:id', async (req, res) => {
  const item = await prisma.memBuffer.findFirst({
    where: { id: Number(req.params.id), source: { contains: String(uid(req)) } }
  })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  await prisma.memBuffer.delete({ where: { id: item.id } })
  res.status(204).end()
})

router.delete('/buffer', async (req, res) => {
  const { traite } = req.query
  const where = { source: { contains: String(uid(req)) } }
  if (traite === 'true') where.traite = true
  else if (traite === 'false') where.traite = false
  await prisma.memBuffer.deleteMany({ where })
  res.status(204).end()
})

// ─── RECHERCHE MANUELLE ───────────────────────────────────────────────────────

router.post('/recherche', async (req, res) => {
  const { query } = req.body
  if (!query?.trim()) return res.status(400).json({ error: 'Query requise' })
  const resultats = await rechercheMemoire(query.trim(), uid(req))
  res.json(resultats)
})

// ─── CONSOLIDATION MANUELLE ───────────────────────────────────────────────────

router.post('/consolider', async (req, res) => {
  try {
    const params = await prisma.configParam.findMany({
      where: { cle: { in: ['llm.provider', 'llm.flash_model'] } }
    })
    const map = Object.fromEntries(params.map(p => [p.cle, p.valeur]))
    const provider = map['llm.provider'] || 'gemini'
    const model = map['llm.flash_model'] || 'gemini-2.5-flash'

    const result = await consolidateUser(uid(req), provider, model)
    res.json(result)
  } catch (err) {
    logError(`consolidation manuelle: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// ─── STATS ────────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  const [souvenirs, preferences, contacts, bufferTotal, bufferNonTraite] = await Promise.all([
    prisma.memSouvenir.count({ where: { userId: uid(req) } }),
    prisma.memPreference.count({ where: { userId: uid(req) } }),
    prisma.memContact.count({ where: { userId: uid(req) } }),
    prisma.memBuffer.count({ where: { source: { contains: String(uid(req)) } } }),
    prisma.memBuffer.count({ where: { source: { contains: String(uid(req)) }, traite: false } })
  ])
  res.json({ souvenirs, preferences, contacts, bufferTotal, bufferNonTraite })
})

export default router
