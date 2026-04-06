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
import prisma  from '../../config/db.js'
import { callAI }   from '../../llm/providers.js'
import { logError, logAction } from '../../logs/logger.js'

const GRAPH_URL = 'https://graph.facebook.com/v21.0'

// ── Appel Graph API ───────────────────────────────────────────────────────────

async function graphGet(path, params = {}) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN non défini')
  const qs = new URLSearchParams({ access_token: token, ...params })
  const r = await fetch(`${GRAPH_URL}${path}?${qs}`)
  const data = await r.json()
  if (data.error) throw new Error(`Meta API: ${data.error.message}`)
  return data
}

async function graphPost(path, body = {}) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN non défini')
  const r = await fetch(`${GRAPH_URL}${path}`, {
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
  const secret = process.env.META_APP_SECRET
  if (!secret) return true // tolérance en dev sans secret configuré
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// ── Récupérer les commentaires récents ────────────────────────────────────────

export async function fetchCommentaires(mediaId) {
  const igUserId = process.env.META_IG_USER_ID
  if (!igUserId) throw new Error('META_IG_USER_ID non défini')
  return graphGet(`/${mediaId}/comments`, { fields: 'id,text,username,timestamp,replies{id,text,username}' })
}

// ── Récupérer les conversations (messages) ────────────────────────────────────

export async function fetchConversations() {
  const igUserId = process.env.META_IG_USER_ID
  if (!igUserId) throw new Error('META_IG_USER_ID non défini')
  return graphGet(`/${igUserId}/conversations`, {
    platform: 'instagram',
    fields: 'id,participants,messages{id,message,from,created_time}',
  })
}

// ── Répondre à un commentaire ─────────────────────────────────────────────────

export async function repondreCommentaire(commentaireId, message) {
  return graphPost(`/${commentaireId}/replies`, { message })
}

// ── Répondre à un message privé ───────────────────────────────────────────────

export async function repondreMessage(recipientIgId, message) {
  const igUserId = process.env.META_IG_USER_ID
  if (!igUserId) throw new Error('META_IG_USER_ID non défini')
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
