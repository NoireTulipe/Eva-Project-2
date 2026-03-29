import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { invalidatePromptCache } from '../llm/prompts.js'
import prisma from '../config/db.js'
import { logAction } from '../logs/logger.js'

const router = Router()

// Middleware : authentification + rôle admin requis
router.use(authMiddleware)
router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  }
  next()
})

// ─── PROMPTS ──────────────────────────────────────────────────────────────────

// GET /admin/prompts — liste tous les prompts
router.get('/prompts', async (req, res) => {
  const prompts = await prisma.prompt.findMany({ orderBy: [{ module: 'asc' }, { role: 'asc' }] })
  res.json(prompts)
})

// PUT /admin/prompts/:id — modifie un prompt
router.put('/prompts/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { contenu, actif } = req.body

  const prompt = await prisma.prompt.update({
    where: { id },
    data: {
      ...(contenu !== undefined && { contenu }),
      ...(actif !== undefined && { actif })
    }
  })

  invalidatePromptCache()
  logAction(`Admin: prompt ${id} modifié (module=${prompt.module}, role=${prompt.role})`)
  res.json(prompt)
})

// ─── CONFIG LLM ───────────────────────────────────────────────────────────────

// GET /admin/config — liste tous les ConfigParam
router.get('/config', async (req, res) => {
  const params = await prisma.configParam.findMany({ orderBy: { cle: 'asc' } })
  res.json(params)
})

// PUT /admin/config/:id — modifie la valeur d'un ConfigParam
router.put('/config/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { valeur } = req.body

  if (valeur === undefined) {
    return res.status(400).json({ error: 'Champ "valeur" requis' })
  }

  const param = await prisma.configParam.update({
    where: { id },
    data: { valeur }
  })

  logAction(`Admin: config ${param.cle} → ${valeur}`)
  res.json(param)
})

// ─── DISCORD CANAUX ───────────────────────────────────────────────────────────

// GET /admin/discord/canaux — liste tous les canaux
router.get('/discord/canaux', async (req, res) => {
  const canaux = await prisma.canalDiscord.findMany({ orderBy: { nom: 'asc' } })
  res.json(canaux)
})

// POST /admin/discord/canaux — créer un canal
router.post('/discord/canaux', async (req, res) => {
  const { channelId, nom, mode = 'conversation', categories = [] } = req.body

  if (!channelId || !nom) {
    return res.status(400).json({ error: 'channelId et nom requis' })
  }

  const canal = await prisma.canalDiscord.create({
    data: {
      channelId,
      nom,
      mode,
      categories: JSON.stringify(categories)
    }
  })

  logAction(`Admin: canal Discord créé — ${nom} (${channelId})`)
  res.status(201).json(canal)
})

// PUT /admin/discord/canaux/:id — modifier un canal
router.put('/discord/canaux/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { nom, mode, categories, actif } = req.body

  const canal = await prisma.canalDiscord.update({
    where: { id },
    data: {
      ...(nom !== undefined && { nom }),
      ...(mode !== undefined && { mode }),
      ...(categories !== undefined && { categories: JSON.stringify(categories) }),
      ...(actif !== undefined && { actif })
    }
  })

  logAction(`Admin: canal Discord ${id} modifié`)
  res.json(canal)
})

// DELETE /admin/discord/canaux/:id — supprimer un canal
router.delete('/discord/canaux/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  await prisma.canalDiscord.delete({ where: { id } })
  logAction(`Admin: canal Discord ${id} supprimé`)
  res.status(204).end()
})

export default router
