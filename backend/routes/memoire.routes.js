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

// ─── INCLUSIONS POUR LES REQUÊTES ENRICHIES ───────────────────────────────────

const CONTACT_INCLUDE = {
  relations: { select: { id: true, nom: true, description: true } },
  souvenirs: { select: { id: true, contenu: true } }
}

const SOUVENIR_INCLUDE = {
  contacts: { select: { id: true, nom: true } }
}

// ─── SOUVENIRS ────────────────────────────────────────────────────────────────

router.get('/souvenirs', async (req, res) => {
  const items = await prisma.memSouvenir.findMany({
    where: { userId: uid(req) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, contenu: true, createdAt: true, updatedAt: true, contacts: { select: { id: true, nom: true } } }
  })
  res.json(items)
})

router.post('/souvenirs', async (req, res) => {
  const { contenu } = req.body
  if (!contenu?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const item = await prisma.memSouvenir.create({
    data: { userId: uid(req), contenu: contenu.trim(), embedding },
    include: SOUVENIR_INCLUDE
  })
  res.status(201).json(item)
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
    select: { id: true, contenu: true, createdAt: true, updatedAt: true, contacts: { select: { id: true, nom: true } } }
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
    data: { cle: cle?.trim() || item.cle, contenu: contenu.trim(), embedding },
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
    select: {
      id: true, nom: true, contenu: true, createdAt: true, updatedAt: true,
      relations: { select: { id: true, nom: true, description: true } },
      souvenirs: { select: { id: true, contenu: true } }
    }
  })
  res.json(items)
})

router.post('/contacts', async (req, res) => {
  const { nom, contenu } = req.body
  if (!nom?.trim() || !contenu?.trim()) return res.status(400).json({ error: 'Nom et contenu requis' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const item = await prisma.memContact.create({
    data: { userId: uid(req), nom: nom.trim(), contenu: contenu.trim(), embedding },
    include: CONTACT_INCLUDE
  })
  res.status(201).json(item)
})

router.put('/contacts/:id', async (req, res) => {
  const { nom, contenu } = req.body
  if (!contenu?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  const item = await prisma.memContact.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  const embedding = serializeVector(await embed(contenu.trim()))
  const updated = await prisma.memContact.update({
    where: { id: item.id },
    data: { nom: nom?.trim() || item.nom, contenu: contenu.trim(), embedding },
    select: {
      id: true, nom: true, contenu: true, createdAt: true, updatedAt: true,
      relations: { select: { id: true, nom: true, description: true } },
      souvenirs: { select: { id: true, contenu: true } }
    }
  })
  res.json(updated)
})

router.delete('/contacts/:id', async (req, res) => {
  const item = await prisma.memContact.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  await prisma.memContact.delete({ where: { id: item.id } })
  res.status(204).end()
})

// ─── CONTACTS : gestion des relations liées ──────────────────────────────────

// Lier une relation à un contact
router.post('/contacts/:id/relations', async (req, res) => {
  const contactId = Number(req.params.id)
  const { relationId } = req.body
  if (!relationId) return res.status(400).json({ error: 'relationId requis' })

  const [contact, relation] = await Promise.all([
    prisma.memContact.findFirst({ where: { id: contactId, userId: uid(req) } }),
    prisma.memRelation.findFirst({ where: { id: Number(relationId), userId: uid(req) } })
  ])
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' })
  if (!relation) return res.status(404).json({ error: 'Relation introuvable' })

  await prisma.memContact.update({
    where: { id: contactId },
    data: { relations: { connect: { id: relation.id } } }
  })
  res.status(204).end()
})

// Délier une relation d'un contact
router.delete('/contacts/:id/relations/:relId', async (req, res) => {
  const contactId = Number(req.params.id)
  const relId = Number(req.params.relId)

  const contact = await prisma.memContact.findFirst({ where: { id: contactId, userId: uid(req) } })
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' })

  await prisma.memContact.update({
    where: { id: contactId },
    data: { relations: { disconnect: { id: relId } } }
  })
  res.status(204).end()
})

// Lier un souvenir à un contact
router.post('/contacts/:id/souvenirs', async (req, res) => {
  const contactId = Number(req.params.id)
  const { souvenirId } = req.body
  if (!souvenirId) return res.status(400).json({ error: 'souvenirId requis' })

  const [contact, souvenir] = await Promise.all([
    prisma.memContact.findFirst({ where: { id: contactId, userId: uid(req) } }),
    prisma.memSouvenir.findFirst({ where: { id: Number(souvenirId), userId: uid(req) } })
  ])
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' })
  if (!souvenir) return res.status(404).json({ error: 'Souvenir introuvable' })

  await prisma.memContact.update({
    where: { id: contactId },
    data: { souvenirs: { connect: { id: souvenir.id } } }
  })
  res.status(204).end()
})

// Délier un souvenir d'un contact
router.delete('/contacts/:id/souvenirs/:souvenirId', async (req, res) => {
  const contactId = Number(req.params.id)
  const souvenirId = Number(req.params.souvenirId)

  const contact = await prisma.memContact.findFirst({ where: { id: contactId, userId: uid(req) } })
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' })

  await prisma.memContact.update({
    where: { id: contactId },
    data: { souvenirs: { disconnect: { id: souvenirId } } }
  })
  res.status(204).end()
})

// ─── RELATIONS ────────────────────────────────────────────────────────────────

router.get('/relations', async (req, res) => {
  const items = await prisma.memRelation.findMany({
    where: { userId: uid(req) },
    orderBy: { nom: 'asc' },
    select: {
      id: true, nom: true, description: true, createdAt: true,
      contacts: { select: { id: true, nom: true } }
    }
  })
  res.json(items)
})

router.post('/relations', async (req, res) => {
  const { nom, description } = req.body
  if (!nom?.trim()) return res.status(400).json({ error: 'Nom requis' })
  try {
    const item = await prisma.memRelation.create({
      data: { userId: uid(req), nom: nom.trim(), description: description?.trim() || null },
      select: { id: true, nom: true, description: true, createdAt: true, contacts: { select: { id: true, nom: true } } }
    })
    res.status(201).json(item)
  } catch {
    res.status(409).json({ error: 'Une relation avec ce nom existe déjà' })
  }
})

router.put('/relations/:id', async (req, res) => {
  const { nom, description } = req.body
  const item = await prisma.memRelation.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  const updated = await prisma.memRelation.update({
    where: { id: item.id },
    data: {
      nom: nom?.trim() || item.nom,
      description: description !== undefined ? (description?.trim() || null) : item.description
    },
    select: { id: true, nom: true, description: true, createdAt: true, contacts: { select: { id: true, nom: true } } }
  })
  res.json(updated)
})

router.delete('/relations/:id', async (req, res) => {
  const item = await prisma.memRelation.findFirst({ where: { id: Number(req.params.id), userId: uid(req) } })
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  await prisma.memRelation.delete({ where: { id: item.id } })
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
  const [souvenirs, preferences, contacts, relations, bufferTotal, bufferNonTraite] = await Promise.all([
    prisma.memSouvenir.count({ where: { userId: uid(req) } }),
    prisma.memPreference.count({ where: { userId: uid(req) } }),
    prisma.memContact.count({ where: { userId: uid(req) } }),
    prisma.memRelation.count({ where: { userId: uid(req) } }),
    prisma.memBuffer.count({ where: { source: { contains: String(uid(req)) } } }),
    prisma.memBuffer.count({ where: { source: { contains: String(uid(req)) }, traite: false } })
  ])
  res.json({ souvenirs, preferences, contacts, relations, bufferTotal, bufferNonTraite })
})

export default router
