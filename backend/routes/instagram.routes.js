import express, { Router } from 'express'
import multer from 'multer'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { authMiddleware } from '../middleware/auth.js'
import * as svc  from '../modules/instagram/instagram.service.js'
import * as meta from '../modules/instagram/instagram.meta.js'
import { callAI } from '../llm/providers.js'
import prisma from '../config/db.js'
import { logAction } from '../logs/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_BASE = resolve(__dirname, '../uploads/instagram')

const router = Router()
router.use(authMiddleware)

// ─── Multer — stockage par sous-dossier ───────────────────────────────────────

function makeStorage(sub) {
  return multer.diskStorage({
    destination: resolve(UPLOADS_BASE, sub),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
      cb(null, `${unique}${extname(file.originalname)}`)
    }
  })
}

const uploadBg  = multer({ storage: makeStorage('backgrounds') })
const uploadEl  = multer({ storage: makeStorage('elements') })
const uploadFnt = multer({ storage: makeStorage('fonts') })

// ─── BACKGROUNDS ──────────────────────────────────────────────────────────────

router.get('/backgrounds', async (req, res) => {
  res.json(await svc.listBackgrounds())
})

router.post('/backgrounds', uploadBg.single('fichier'), async (req, res) => {
  try {
    const { nom, estDefaut } = req.body
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' })
    const bg = await svc.createBackground({
      nom,
      fichier: req.file.filename,
      estDefaut: estDefaut === 'true',
    })
    res.status(201).json(bg)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/backgrounds/:id/defaut', async (req, res) => {
  try {
    res.json(await svc.setDefaultBackground(Number(req.params.id)))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/backgrounds/:id', async (req, res) => {
  try {
    await svc.deleteBackground(Number(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── ÉLÉMENTS ─────────────────────────────────────────────────────────────────

router.get('/elements', async (req, res) => {
  res.json(await svc.listElements(req.query.tag))
})

router.post('/elements', uploadEl.single('fichier'), async (req, res) => {
  try {
    const { nom, tags } = req.body
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' })
    const el = await svc.createElement({ nom, fichier: req.file.filename, tags })
    res.status(201).json(el)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/elements/:id', async (req, res) => {
  try {
    res.json(await svc.updateElement(Number(req.params.id), req.body))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/elements/:id', async (req, res) => {
  try {
    await svc.deleteElement(Number(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── FONTS ────────────────────────────────────────────────────────────────────

router.get('/fonts', async (req, res) => {
  res.json(await svc.listFonts())
})

router.post('/fonts', uploadFnt.single('fichier'), async (req, res) => {
  try {
    const { nom, googleFont, estDefautTitre, estDefautTexte } = req.body
    const font = await svc.createFont({
      nom,
      fichier: req.file?.filename ?? null,
      googleFont: googleFont ?? null,
      estDefautTitre: estDefautTitre === 'true',
      estDefautTexte: estDefautTexte === 'true',
    })
    res.status(201).json(font)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/fonts/:id/defaut', async (req, res) => {
  try {
    res.json(await svc.setDefaultFont(Number(req.params.id), req.body.role))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/fonts/:id', async (req, res) => {
  try {
    await svc.deleteFont(Number(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── COULEURS ─────────────────────────────────────────────────────────────────

router.get('/couleurs', async (req, res) => {
  res.json(await svc.listCouleurs())
})

router.post('/couleurs', async (req, res) => {
  try {
    res.status(201).json(await svc.createCouleur(req.body))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/couleurs/:id', async (req, res) => {
  try {
    res.json(await svc.updateCouleur(Number(req.params.id), req.body))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/couleurs/:id', async (req, res) => {
  try {
    await svc.deleteCouleur(Number(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POSTS ────────────────────────────────────────────────────────────────────

router.get('/posts', async (req, res) => {
  res.json(await svc.listPosts())
})

router.get('/posts/:id', async (req, res) => {
  const post = await svc.getPost(Number(req.params.id))
  if (!post) return res.status(404).json({ error: 'Post introuvable' })
  res.json(post)
})

router.post('/posts', async (req, res) => {
  try {
    res.status(201).json(await svc.createPost(req.body))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/posts/:id', async (req, res) => {
  try {
    res.json(await svc.updatePost(Number(req.params.id), req.body))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/posts/:id', async (req, res) => {
  try {
    await svc.deletePost(Number(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── EXCLUSIONS ───────────────────────────────────────────────────────────────

router.get('/exclusions', async (req, res) => {
  res.json(await svc.listExclusions())
})

router.post('/exclusions', async (req, res) => {
  try {
    res.status(201).json(await svc.createExclusion(req.body))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/exclusions/:id', async (req, res) => {
  try {
    await svc.deleteExclusion(Number(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GÉNÉRATION IA ────────────────────────────────────────────────────────────

router.post('/generer-texte', async (req, res) => {
  try {
    const { sujet, nbPhrases = 3, nbSlides = 1, promptOverride } = req.body
    if (!sujet?.trim()) return res.status(400).json({ error: 'Sujet requis' })

    // Récupérer le prompt depuis la DB (module: instagram, role: texte_image) ou utiliser le défaut
    const promptRecord = await prisma.prompt.findUnique({
      where: { module_role: { module: 'instagram', role: 'texte_image' } }
    })

    const promptTemplate = promptOverride ?? promptRecord?.contenu ?? `Tu es un expert en communication pour une maison d'édition. Génère un texte percutant pour une publication Instagram.

Sujet : {sujet}
Nombre de phrases maximum par vignette : {nbPhrases}
Nombre de vignettes : {nbSlides}

Réponds en JSON valide avec ce format exact, sans markdown ni backticks :
{ "textes": ["texte vignette 1", "texte vignette 2"], "legende": "texte de la légende Instagram avec emojis et hashtags" }

Le texte de chaque vignette doit être court, impactant, lisible en 3 secondes.`

    const prompt = promptTemplate
      .replace('{sujet}', sujet)
      .replace('{nbPhrases}', String(nbPhrases))
      .replace('{nbSlides}', String(nbSlides))

    const model = process.env.MISTRAL_FLASH_MODEL || 'mistral-small-latest'
    const raw = await callAI('mistral', model, [{ role: 'user', content: prompt }])

    // Extraire le JSON de la réponse
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Réponse Mistral invalide — JSON introuvable')

    const parsed = JSON.parse(jsonMatch[0])

    // S'assurer d'avoir le bon nombre de vignettes
    while (parsed.textes.length < nbSlides) {
      parsed.textes.push(parsed.textes[parsed.textes.length - 1] ?? '')
    }
    parsed.textes = parsed.textes.slice(0, nbSlides)

    res.json(parsed)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── BROUILLONS ───────────────────────────────────────────────────────────────

router.get('/brouillons', async (req, res) => {
  res.json(await svc.listBrouillons(req.query.statut))
})

router.put('/brouillons/:id', async (req, res) => {
  try {
    res.json(await svc.updateBrouillon(Number(req.params.id), req.body))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Envoyer un brouillon via Meta API
router.post('/brouillons/:id/envoyer', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const b = await prisma.igBrouillon.findUnique({ where: { id } })
    if (!b) return res.status(404).json({ error: 'Brouillon introuvable' })
    if (b.statut === 'envoye') return res.status(400).json({ error: 'Déjà envoyé' })

    if (b.type === 'commentaire') {
      // L'ID du commentaire est stocké dans igAuteurId pour les commentaires
      await meta.repondreCommentaire(b.igAuteurId, b.textePropose)
    } else {
      await meta.repondreMessage(b.igAuteurId, b.textePropose)
    }

    const updated = await svc.updateBrouillon(id, { statut: 'envoye' })
    logAction(`Instagram: brouillon ${id} envoyé (${b.type})`)
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Ignorer un brouillon
router.post('/brouillons/:id/ignorer', async (req, res) => {
  try {
    res.json(await svc.updateBrouillon(Number(req.params.id), { statut: 'ignore' }))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── WEBHOOK META ─────────────────────────────────────────────────────────────
// Ces routes sont SANS authMiddleware — elles sont appelées par Meta directement

// GET — vérification du webhook (Meta envoie un challenge)
router.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logAction('Instagram: webhook Meta vérifié')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// POST — réception des événements (commentaires, messages)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Valider la signature X-Hub-Signature-256
  const sig = req.headers['x-hub-signature-256']
  if (sig && !meta.verifyWebhookSignature(req.body, sig)) {
    return res.sendStatus(401)
  }

  res.sendStatus(200) // Répondre immédiatement à Meta (< 20s)

  try {
    const body = JSON.parse(req.body.toString())
    if (body.object !== 'instagram') return

    // Lire le mode (auto ou brouillon) depuis ConfigParam
    const autoParam = await prisma.configParam.findUnique({ where: { cle: 'instagram.auto_reply' } })
    const autoReply = autoParam?.valeur === 'true'

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const val = change.value

        // ── Commentaire ──────────────────────────────────────────────────────
        if (change.field === 'comments') {
          await meta.traiterCommentaire({
            igAuteurId:  val.from?.id ?? '',
            igAuteurNom: val.from?.username ?? null,
            commentaireId: val.id,
            texte: val.text ?? '',
            autoReply,
          }).catch(e => logError(`Instagram webhook commentaire: ${e.message}`))
        }

        // ── Message ──────────────────────────────────────────────────────────
        if (change.field === 'messages') {
          const msg = val.messages?.[0]
          if (!msg) continue
          await meta.traiterMessage({
            igAuteurId:  val.sender?.id ?? '',
            igAuteurNom: val.sender?.username ?? null,
            texte: msg.text ?? '',
            autoReply,
          }).catch(e => logError(`Instagram webhook message: ${e.message}`))
        }
      }
    }
  } catch (e) {
    logError(`Instagram webhook: ${e.message}`)
  }
})

// ─── CONFIG INSTAGRAM ─────────────────────────────────────────────────────────

router.get('/config', async (req, res) => {
  const keys = ['instagram.auto_reply']
  const params = await prisma.configParam.findMany({ where: { cle: { in: keys } } })
  res.json(params)
})

router.put('/config/:cle', async (req, res) => {
  try {
    const { valeur } = req.body
    const param = await prisma.configParam.upsert({
      where: { cle: req.params.cle },
      update: { valeur },
      create: { cle: req.params.cle, valeur, description: 'Config Instagram' },
    })
    res.json(param)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
