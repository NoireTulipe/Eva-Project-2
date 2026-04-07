/**
 * instagram.meta.js — Intégration Meta Graph API
 *
 * Prérequis .env :
 *   META_ACCESS_TOKEN       — User Access Token long-lived (60j) ou Page Access Token
 *   META_IG_USER_ID         — ID du compte Instagram Business
 *   META_WEBHOOK_VERIFY_TOKEN — Token secret pour valider le webhook Meta
 *   META_APP_SECRET         — App Secret pour valider la signature des webhooks
 */

import crypto from 'crypto'
import { writeFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import prisma  from '../../config/db.js'
import { callAI }   from '../../llm/providers.js'
import { logError, logAction } from '../../logs/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const POSTS_DIR = resolve(__dirname, '../../uploads/instagram/posts')

const GRAPH_URL    = 'https://graph.facebook.com/v21.0'
const IG_GRAPH_URL = 'https://graph.instagram.com/v21.0'

// ── Token & ID : env en priorité, sinon DB ────────────────────────────────────

async function getToken() {
  if (process.env.META_ACCESS_TOKEN) return process.env.META_ACCESS_TOKEN
  const row = await prisma.configParam.findUnique({ where: { cle: 'instagram.access_token' } })
  if (row?.valeur) return row.valeur
  throw new Error('Token Meta non configuré (ni .env META_ACCESS_TOKEN, ni instagram.access_token en DB)')
}

async function getIgUserId() {
  if (process.env.META_IG_USER_ID) return process.env.META_IG_USER_ID
  const row = await prisma.configParam.findUnique({ where: { cle: 'instagram.ig_user_id' } })
  if (row?.valeur) return row.valeur
  throw new Error('ID compte Instagram non configuré (ni .env META_IG_USER_ID, ni instagram.ig_user_id en DB)')
}

// ── Appel Graph API (Instagram Login for Business = graph.instagram.com) ─────

async function graphGet(path, params = {}) {
  const token = await getToken()
  const qs = new URLSearchParams({ access_token: token, ...params })
  // Essaie d'abord l'API Instagram, fallback Facebook si 4xx
  const r = await fetch(`${IG_GRAPH_URL}${path}?${qs}`)
  const data = await r.json()
  if (data.error) throw new Error(`Meta API: ${data.error.message}`)
  return data
}

async function graphPost(path, body = {}) {
  const token = await getToken()
  const r = await fetch(`${IG_GRAPH_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, ...body }),
  })
  const data = await r.json()
  if (data.error) throw new Error(`Meta API: ${data.error.message}`)
  return data
}

// ── Validation de la signature webhook ───────────────────────────────────────

export function verifyWebhookSignature(rawBody, signature) {
  // Bypass temporaire — mettre META_SKIP_SIG_CHECK=true dans .env pour ignorer la vérification
  if (process.env.META_SKIP_SIG_CHECK === 'true') {
    logAction('Webhook: vérification signature DÉSACTIVÉE (META_SKIP_SIG_CHECK=true)')
    return true
  }
  const secret = process.env.META_APP_SECRET
  if (!secret) return true
  const expected = `sha256=${crypto.createHmac('sha256', secret.trim()).update(rawBody).digest('hex')}`
  logAction(`Webhook sig reçue  : ${signature}`)
  logAction(`Webhook sig attendue: ${expected}`)
  if (Buffer.from(signature).length !== Buffer.from(expected).length) return false
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// ── Récupérer les commentaires récents ────────────────────────────────────────

export async function fetchCommentaires(mediaId) {
  return graphGet(`/${mediaId}/comments`, { fields: 'id,text,username,timestamp,replies{id,text,username}' })
}

// ── Récupérer les conversations (messages) ────────────────────────────────────

export async function fetchConversations() {
  const igUserId = await getIgUserId()
  return graphGet(`/${igUserId}/conversations`, {
    platform: 'instagram',
    fields: 'id,participants,messages{id,message,from,created_time}',
  })
}

// ── Publier un post (image unique ou carrousel) ───────────────────────────────

/**
 * Publie un IgPost sur Instagram via Meta Graph API.
 * Flow : base64 PNG → fichier local → URL publique → Media Container → Publish
 *
 * @param {number} postId  - id de l'IgPost
 * @param {string[]} imagesBase64 - tableau de data URLs PNG (une par vignette)
 */
export async function publierPost(postId, imagesBase64) {
  const igUserId = await getIgUserId()
  const baseUrl  = process.env.APP_BASE_URL || `https://eva.echodeplumes.com`

  const post = await prisma.igPost.findUnique({ where: { id: postId } })
  if (!post) throw new Error('Post introuvable')

  // 1. Sauvegarder les images sur le disque
  const filenames = []
  for (let i = 0; i < imagesBase64.length; i++) {
    const b64 = imagesBase64[i].replace(/^data:image\/\w+;base64,/, '')
    const filename = `post-${postId}-${i}-${Date.now()}.png`
    await writeFile(resolve(POSTS_DIR, filename), Buffer.from(b64, 'base64'))
    filenames.push(filename)
  }

  try {
    let creationId

    if (imagesBase64.length === 1) {
      // ── Post simple ──────────────────────────────────────────────────────────
      const imageUrl = `${baseUrl}/uploads/instagram/posts/${filenames[0]}`
      const container = await graphPost(`/${igUserId}/media`, {
        image_url: imageUrl,
        caption: post.legende ?? '',
      })
      creationId = container.id
    } else {
      // ── Carrousel ────────────────────────────────────────────────────────────
      const itemIds = []
      for (const filename of filenames) {
        const imageUrl = `${baseUrl}/uploads/instagram/posts/${filename}`
        const item = await graphPost(`/${igUserId}/media`, {
          image_url: imageUrl,
          is_carousel_item: true,
        })
        itemIds.push(item.id)
      }
      const carousel = await graphPost(`/${igUserId}/media`, {
        media_type: 'CAROUSEL',
        caption: post.legende ?? '',
        children: itemIds.join(','),
      })
      creationId = carousel.id
    }

    // 2. Publier le container
    const result = await graphPost(`/${igUserId}/media_publish`, { creation_id: creationId })

    // 3. Mettre à jour le post en DB
    await prisma.igPost.update({
      where: { id: postId },
      data: { statut: 'publie', publishedAt: new Date(), metaMediaId: result.id, erreurPubli: null }
    })

    logAction(`Instagram: post ${postId} publié (mediaId=${result.id})`)
    return result
  } catch (e) {
    await prisma.igPost.update({
      where: { id: postId },
      data: { statut: 'erreur', erreurPubli: e.message }
    })
    logError(`Instagram: échec publication post ${postId} — ${e.message}`)
    throw e
  }
}

// ── Répondre à un commentaire ─────────────────────────────────────────────────

export async function repondreCommentaire(commentaireId, message) {
  return graphPost(`/${commentaireId}/replies`, { message })
}

// ── Répondre à un message privé ───────────────────────────────────────────────

export async function repondreMessage(recipientIgId, message) {
  return graphPost(`/me/messages`, {
    recipient: { id: recipientIgId },
    message: { text: message },
  })
}

// ── Générer une réponse Mistral ───────────────────────────────────────────────

async function genererReponse(type, variables) {
  const prompt = await prisma.prompt.findUnique({
    where: { module_role: { module: 'instagram', role: `reponse_${type}` } }
  })
  if (!prompt) throw new Error(`Prompt instagram/reponse_${type} introuvable`)

  let contenu = prompt.contenu
  for (const [key, val] of Object.entries(variables)) {
    contenu = contenu.replaceAll(`{${key}}`, val ?? '')
  }

  const model = process.env.MISTRAL_FLASH_MODEL || 'mistral-small-latest'
  return callAI('mistral', model, [{ role: 'user', content: contenu }])
}

// ── Traiter un événement commentaire ─────────────────────────────────────────

export async function traiterCommentaire({ igAuteurId, igAuteurNom, commentaireId, texte, autoReply }) {
  // Vérifier exclusion
  const exclu = await prisma.igExclusion.findUnique({ where: { igUserId: igAuteurId } })
  if (exclu) {
    logAction(`Instagram: commentaire de ${igAuteurNom} ignoré (exclusion)`)
    return { ignore: true, raison: 'exclusion' }
  }

  const textePropose = await genererReponse('commentaire', {
    commentaire: texte,
    auteur: igAuteurNom ?? igAuteurId,
  })

  if (autoReply) {
    await repondreCommentaire(commentaireId, textePropose)
    await prisma.igBrouillon.create({
      data: {
        type: 'commentaire',
        igAuteurId, igAuteurNom: igAuteurNom ?? null,
        messageOriginal: texte,
        textePropose,
        statut: 'envoye',
      }
    })
    logAction(`Instagram: réponse auto commentaire → ${igAuteurNom}`)
    return { envoye: true, textePropose }
  }

  // Mode brouillon
  const brouillon = await prisma.igBrouillon.create({
    data: {
      type: 'commentaire',
      igAuteurId, igAuteurNom: igAuteurNom ?? null,
      messageOriginal: texte,
      textePropose,
      statut: 'en_attente',
    }
  })
  return { brouillon }
}

// ── Traiter un événement message ──────────────────────────────────────────────

export async function traiterMessage({ igAuteurId, igAuteurNom, texte, autoReply }) {
  // Vérifier exclusion
  const exclu = await prisma.igExclusion.findUnique({ where: { igUserId: igAuteurId } })
  if (exclu) {
    logAction(`Instagram: message de ${igAuteurNom} ignoré (exclusion)`)
    return { ignore: true, raison: 'exclusion' }
  }

  const textePropose = await genererReponse('message', {
    message: texte,
    expediteur: igAuteurNom ?? igAuteurId,
  })

  if (autoReply) {
    await repondreMessage(igAuteurId, textePropose)
    await prisma.igBrouillon.create({
      data: {
        type: 'message',
        igAuteurId, igAuteurNom: igAuteurNom ?? null,
        messageOriginal: texte,
        textePropose,
        statut: 'envoye',
      }
    })
    logAction(`Instagram: réponse auto message → ${igAuteurNom}`)
    return { envoye: true, textePropose }
  }

  const brouillon = await prisma.igBrouillon.create({
    data: {
      type: 'message',
      igAuteurId, igAuteurNom: igAuteurNom ?? null,
      messageOriginal: texte,
      textePropose,
      statut: 'en_attente',
    }
  })
  return { brouillon }
}
