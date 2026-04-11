import express, { Router } from 'express'
import multer from 'multer'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { authMiddleware } from '../middleware/auth.js'
import * as svc  from '../modules/instagram/instagram.service.js'
import * as meta from '../modules/instagram/instagram.meta.js'
import { callAI } from '../llm/providers.js'
import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_BASE = resolve(__dirname, '../uploads/instagram')

// Router PUBLIC — webhook Meta + OAuth callback (sans auth)
export const webhookRouter = Router()

// ── OAuth callback — Meta redirige ici après autorisation ─────────────────────
webhookRouter.get('/oauth/callback', async (req, res) => {
  const { code, error, error_description } = req.query
  const redirectBase = '/eva/instagram?tab=parametres'

  if (error) {
    logError(`Instagram OAuth: ${error} — ${error_description}`)
    return res.redirect(`${redirectBase}&oauth=error&msg=${encodeURIComponent(error_description ?? error)}`)
  }
  if (!code) return res.redirect(`${redirectBase}&oauth=error&msg=code_manquant`)

  try {
    const appId     = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    const baseUrl   = process.env.APP_URL ?? 'https://eva.echodeplumes.com'
    const redirectUri = `${baseUrl}/api/instagram/oauth/callback`

    if (!appId || !appSecret) throw new Error('META_APP_ID ou META_APP_SECRET non défini dans .env')

    // 1. Code → token court (Instagram Login for Business)
    const formData = new URLSearchParams({
      client_id: appId, client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri, code,
    })
    const shortRes  = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: formData })
    const shortData = await shortRes.json()
    if (shortData.error_type) throw new Error(shortData.error_message ?? shortData.error_type)

    const shortToken = shortData.access_token
    const igUserId   = String(shortData.user_id)

    // 2. Token court → token long (60 jours)
    const llUrl  = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_id=${appId}&client_secret=${appSecret}&access_token=${shortToken}`
    const llRes  = await fetch(llUrl)
    const llData = await llRes.json()
    if (llData.error) throw new Error(llData.error.message ?? JSON.stringify(llData.error))

    const longToken  = llData.access_token
    const expiresIn  = llData.expires_in  // ~5184000 secondes = 60 jours
    const expiresAt  = new Date(Date.now() + expiresIn * 1000).toISOString()

    // 3. Sauvegarder en DB
    const upsert = (cle, valeur, description) => prisma.configParam.upsert({
      where: { cle }, create: { cle, valeur, description }, update: { valeur },
    })
    await upsert('instagram.access_token',  longToken,  'Token accès Meta Instagram (60 jours)')
    await upsert('instagram.ig_user_id',    igUserId,   'ID compte Instagram Business')
    await upsert('instagram.token_expires_at', expiresAt, 'Expiration token Meta')

    logAction(`Instagram OAuth: connexion réussie — compte IG #${igUserId}, expire le ${expiresAt}`)
    res.redirect(`${redirectBase}&oauth=success`)
  } catch (e) {
    logError(`Instagram OAuth callback: ${e.message}`)
    res.redirect(`${redirectBase}&oauth=error&msg=${encodeURIComponent(e.message)}`)
  }
})

// Route de diagnostic temporaire — à supprimer une fois le webhook fonctionnel
webhookRouter.get('/webhook-debug', (req, res) => {
  res.json({
    query: req.query,
    url: req.url,
    originalUrl: req.originalUrl,
    envToken: process.env.META_WEBHOOK_VERIFY_TOKEN ? `[défini, ${process.env.META_WEBHOOK_VERIFY_TOKEN.length} chars]` : '[NON DÉFINI]',
  })
})

webhookRouter.get('/webhook', (req, res) => {
  // qs peut parser les dots en objet imbriqué (hub.mode → hub:{mode}) selon la version
  // On supporte les deux formats pour robustesse
  const q         = req.query
  const mode      = q['hub.mode']         ?? q.hub?.mode
  const token     = q['hub.verify_token'] ?? q.hub?.verify_token
  const challenge = q['hub.challenge']    ?? q.hub?.challenge

  logAction(`Instagram webhook: query=${JSON.stringify(q)} → mode="${mode}" token="${token}" challenge="${challenge}"`)

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logAction('Instagram: webhook Meta vérifié')
    return res.status(200).send(challenge)
  }
  logError(`Instagram webhook: token reçu="${token}" attendu="${process.env.META_WEBHOOK_VERIFY_TOKEN}" query_raw=${JSON.stringify(req.query)}`)
  res.sendStatus(403)
})

webhookRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['x-hub-signature-256']
  logAction(`Instagram webhook POST reçu — sig=${sig ? 'présente' : 'absente'} body_len=${req.body?.length ?? 0} content-type=${req.headers['content-type']}`)

  if (sig && !meta.verifyWebhookSignature(req.body, sig)) {
    logError('Instagram webhook POST: signature invalide — rejeté 401')
    return res.sendStatus(401)
  }

  res.sendStatus(200) // Répondre immédiatement à Meta

  try {
    const rawStr = req.body?.toString?.() ?? ''
    if (!rawStr) { logError('Instagram webhook POST: body vide'); return }

    const body = JSON.parse(rawStr)
    logAction(`Instagram webhook POST reçu: object="${body.object}" entries=${body.entry?.length ?? 0} raw=${rawStr.slice(0, 300)}`)

    if (body.object !== 'instagram' && body.object !== 'page') {
      logAction(`Instagram webhook POST: object ignoré (${body.object})`)
      return
    }

    const autoParam = await prisma.configParam.findUnique({ where: { cle: 'instagram.auto_reply' } })
    const autoReply = autoParam?.valeur === 'true'

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        logAction(`Instagram webhook: champ="${change.field}" autoReply=${autoReply}`)
        const val = change.value
        if (change.field === 'comments') {
          await meta.traiterCommentaire({
            igAuteurId: val.from?.id ?? '', igAuteurNom: val.from?.username ?? null,
            commentaireId: val.id, texte: val.text ?? '', autoReply,
          }).catch(e => logError(`Instagram webhook commentaire: ${e.message}`))
        }
        if (change.field === 'messages') {
          // Meta envoie val.message (objet) et non val.messages (tableau)
          const msg = val.message ?? val.messages?.[0]
          if (!msg) { logError(`Instagram webhook message: structure inattendue — val=${JSON.stringify(val).slice(0, 200)}`); continue }
          await meta.traiterMessage({
            igAuteurId: val.sender?.id ?? '', igAuteurNom: val.sender?.username ?? null,
            texte: msg.text ?? '', autoReply,
          }).catch(e => logError(`Instagram webhook message: ${e.message}`))
        }
      }
    }
  } catch (e) {
    logError(`Instagram webhook POST: ${e.message} — body_raw=${req.body?.toString?.()?.slice(0, 200)}`)
  }
})

// Router PRIVÉ — toutes les autres routes (avec auth)
const router = Router()
router.use(authMiddleware)

// ─── OAuth — Générer l'URL d'autorisation Meta ────────────────────────────────

router.get('/oauth/url', (req, res) => {
  const appId = process.env.META_APP_ID
  if (!appId) return res.status(500).json({ error: 'META_APP_ID non configuré dans .env' })

  const baseUrl     = process.env.APP_URL ?? 'https://eva.echodeplumes.com'
  const redirectUri = `${baseUrl}/api/instagram/oauth/callback`
  const scopes      = [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
    'instagram_business_content_publish',
    'instagram_business_manage_insights',
  ].join(',')

  const url = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`
  res.json({ url, redirectUri })
})

// ─── OAuth — Statut connexion ─────────────────────────────────────────────────

router.get('/oauth/status', async (req, res) => {
  try {
    const rows = await prisma.configParam.findMany({
      where: { cle: { in: ['instagram.access_token', 'instagram.ig_user_id', 'instagram.token_expires_at'] } }
    })
    const map = Object.fromEntries(rows.map(r => [r.cle, r.valeur]))
    const connected = !!(
      (process.env.META_ACCESS_TOKEN || map['instagram.access_token']) &&
      (process.env.META_IG_USER_ID   || map['instagram.ig_user_id'])
    )
    const expiresAt   = map['instagram.token_expires_at'] ?? null
    const igUserId    = process.env.META_IG_USER_ID || map['instagram.ig_user_id'] || null
    const tokenSource = process.env.META_ACCESS_TOKEN ? 'env' : (map['instagram.access_token'] ? 'db' : null)
    res.json({ connected, igUserId, expiresAt, tokenSource })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

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

// ─── PUBLICATION ──────────────────────────────────────────────────────────────

// Publier maintenant (images base64 envoyées par le frontend)
router.post('/posts/:id/publier', async (req, res) => {
  try {
    const { images } = req.body // string[] — data URLs PNG
    if (!images?.length) return res.status(400).json({ error: 'Images requises' })
    const result = await meta.publierPost(Number(req.params.id), images)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Programmer une publication
router.post('/posts/:id/programmer', async (req, res) => {
  try {
    const { scheduledAt, images } = req.body
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt requis' })
    if (!images?.length) return res.status(400).json({ error: 'Images requises' })

    // Stocker les exports dans les vignettes (clé _export)
    const post = await prisma.igPost.findUnique({ where: { id: Number(req.params.id) } })
    if (!post) return res.status(404).json({ error: 'Post introuvable' })

    const vignettes = JSON.parse(post.vignettes)
    images.forEach((img, i) => { if (vignettes[i]) vignettes[i]._export = img })

    const updated = await prisma.igPost.update({
      where: { id: Number(req.params.id) },
      data: {
        statut: 'programme',
        scheduledAt: new Date(scheduledAt),
        vignettes: JSON.stringify(vignettes),
      }
    })
    logAction(`Instagram: post ${updated.id} programmé pour ${scheduledAt}`)
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Déprogrammer (remettre en brouillon)
router.post('/posts/:id/deprogrammer', async (req, res) => {
  try {
    const updated = await prisma.igPost.update({
      where: { id: Number(req.params.id) },
      data: { statut: 'brouillon', scheduledAt: null }
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GÉNÉRATION IA ────────────────────────────────────────────────────────────

router.post('/generer-texte', async (req, res) => {
  try {
    const { sujet, champs, legendeInstruction } = req.body
    if (!sujet?.trim()) return res.status(400).json({ error: 'Sujet requis' })
    if (!champs?.length) return res.status(400).json({ error: 'Aucun champ texte défini' })

    // Récupérer le prompt système depuis la DB
    const promptRecord = await prisma.prompt.findUnique({
      where: { module_role: { module: 'instagram', role: 'texte_image' } }
    })

    // Construire la liste des champs pour le prompt
    const champsStr = champs.map(c =>
      `- ${c.nom} : ${c.instruction || '(libre)'}`
    ).join('\n')

    // Construire le JSON attendu en exemple
    const jsonExemple = '{' + champs.map(c => `"${c.nom}":"..."`).join(',') + ',"legende":"..."}'

    const systemPrompt = promptRecord?.contenu ??
      `Tu es expert en communication pour une maison d'édition indépendante. Ton ton est littéraire, chaleureux et passionné.`

    const userPrompt = `${systemPrompt}

Sujet : ${sujet}

Tu dois générer du texte pour une publication Instagram. Chaque champ a un nom exact et une instruction.
IMPORTANT : utilise les noms de champs EXACTEMENT comme indiqué ci-dessous comme clés JSON.

${champs.map(c => `Champ "${c.nom}" : ${c.instruction || 'texte libre adapté au sujet'}`).join('\n')}
Champ "legende" : ${legendeInstruction || 'Légende Instagram complète avec emojis, call-to-action et hashtags pertinents'}

Règles :
- Si un champ demande plusieurs phrases, sépare-les par \\n dans la valeur
- La légende comporte une accroche, un corps, un call-to-action et des hashtags, avec des \\n entre les sections
- Réponds UNIQUEMENT avec le JSON, sans texte avant ni après, sans markdown, sans backticks

JSON attendu (remplace ... par le contenu généré) :
${jsonExemple}`

    const model = process.env.MISTRAL_FLASH_MODEL || 'mistral-small-latest'
    const raw   = await callAI('mistral', model, [{ role: 'user', content: userPrompt }])

    logAction(`Mistral generer-texte raw: ${raw.slice(0, 500)}`)

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Réponse Mistral invalide — JSON introuvable')

    const parsed = JSON.parse(jsonMatch[0])

    // Mistral peut retourner { champs: {...}, legende: "..." } ou le format plat { Titre: "...", legende: "..." }
    let champsObj, legende
    if (parsed.champs && typeof parsed.champs === 'object') {
      // Format imbriqué
      champsObj = parsed.champs
      legende   = parsed.legende ?? ''
    } else {
      // Format plat : toutes les clés sauf "legende" sont des champs
      legende   = parsed.legende ?? ''
      champsObj = Object.fromEntries(Object.entries(parsed).filter(([k]) => k !== 'legende'))
    }

    logAction(`Mistral generer-texte champs: ${JSON.stringify(champsObj)}`)
    res.json({ champs: champsObj, legende })
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

// ─── ACTIVITÉ DU COMPTE ───────────────────────────────────────────────────────

router.get('/activite', async (req, res) => {
  try {
    const igUserId = process.env.META_IG_USER_ID
    const token    = process.env.META_ACCESS_TOKEN
    if (!igUserId || !token) return res.status(503).json({ error: 'META_IG_USER_ID ou META_ACCESS_TOKEN non configuré' })

    const limite = parseInt(req.query.limite) || 10

    // 1. Récupérer les derniers médias publiés
    const mediaUrl = `https://graph.facebook.com/v21.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,thumbnail_url,media_url&limit=${limite}&access_token=${token}`
    const mediaRes  = await fetch(mediaUrl)
    const mediaData = await mediaRes.json()
    if (mediaData.error) throw new Error(`Media: ${mediaData.error.message}`)

    const medias = mediaData.data ?? []

    // 2. Pour chaque média, récupérer les derniers commentaires (max 5 par post)
    const mediasAvecCommentaires = await Promise.all(
      medias.map(async m => {
        try {
          const cUrl = `https://graph.facebook.com/v21.0/${m.id}/comments?fields=id,text,username,timestamp&limit=5&access_token=${token}`
          const cRes  = await fetch(cUrl)
          const cData = await cRes.json()
          return { ...m, comments: cData.data ?? [] }
        } catch {
          return { ...m, comments: [] }
        }
      })
    )

    // 3. Récupérer les dernières conversations (messages) — nécessite instagram_manage_messages
    let conversations = []
    try {
      const convUrl = `https://graph.facebook.com/v21.0/${igUserId}/conversations?platform=instagram&fields=id,updated_time,participants,messages.limit(1){id,message,from,created_time}&limit=${limite}&access_token=${token}`
      const convRes  = await fetch(convUrl)
      const convData = await convRes.json()
      if (!convData.error) conversations = convData.data ?? []
    } catch {
      // permission pas encore accordée — on ignore silencieusement
    }

    // 4. Stats profil
    let profil = null
    try {
      const pUrl = `https://graph.facebook.com/v21.0/${igUserId}?fields=name,username,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`
      const pRes  = await fetch(pUrl)
      const pData = await pRes.json()
      if (!pData.error) profil = pData
    } catch {}

    res.json({ profil, medias: mediasAvecCommentaires, conversations })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── CONFIG INSTAGRAM ─────────────────────────────────────────────────────────

router.get('/config', async (req, res) => {
  const keys = ['instagram.auto_reply']
  const params = await prisma.configParam.findMany({ where: { cle: { in: keys } } })
  const obj = Object.fromEntries(params.map(p => [p.cle, p.valeur]))
  res.json(obj)
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
