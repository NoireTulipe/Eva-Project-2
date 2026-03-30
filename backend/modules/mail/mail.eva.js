import prisma from '../../config/db.js'
import { callAI } from '../../llm/providers.js'
import { getPrompt } from '../../llm/prompts.js'
import { supprimerEmail, archiverEmail, marquerLu, deplacerEmail } from './imap.service.js'
import { logAction, logError } from '../../logs/logger.js'

// Actions reconnues par EVA
const ACTIONS_VALIDES = ['lire', 'archiver', 'supprimer', 'marquer_lu', 'repondre', 'ignorer']

/**
 * Récupère la config LLM (flash model pour l'analyse mail).
 */
async function getLLMConfig() {
  const params = await prisma.configParam.findMany({
    where: { cle: { in: ['llm.provider', 'llm.flash_model'] } }
  })
  const map = Object.fromEntries(params.map(p => [p.cle, p.valeur]))
  return {
    provider: map['llm.provider'] || 'gemini',
    model: map['llm.flash_model'] || 'gemini-2.5-flash'
  }
}

/**
 * Analyse un email et retourne la décision d'EVA.
 * Retourne : { categorie, action, raison, brouillon? }
 */
async function analyserEmail(email, boite, promptGlobal) {
  const { provider, model } = await getLLMConfig()

  const instructionBoite = boite.instructionSpecifique
    ? `\n\n--- Instructions spécifiques pour ${boite.nom} ---\n${boite.instructionSpecifique}`
    : ''

  const systemPrompt = promptGlobal + instructionBoite

  const userMessage = `Analyse cet email reçu dans la boîte "${boite.nom}" (${boite.email}) :

De : ${email.expediteurNom ? `${email.expediteurNom} <${email.expediteur}>` : email.expediteur}
Sujet : ${email.sujet}
Date : ${email.date}
---
${email.corps}
---

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "categorie": "string (ex: commercial, personnel, urgent, spam, notification, facture, autre)",
  "action": "une parmi : lire | archiver | supprimer | marquer_lu | repondre | ignorer",
  "raison": "explication courte de ta décision (1-2 phrases)",
  "brouillon": "null OU le corps de la réponse si action=repondre"
}`

  const raw = await callAI(provider, model, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ])

  // Parser la réponse JSON
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  const decision = JSON.parse(cleaned)

  if (!ACTIONS_VALIDES.includes(decision.action)) {
    decision.action = 'lire'
    decision.raison = (decision.raison || '') + ' [action inconnue → lire par défaut]'
  }

  return decision
}

/**
 * Applique l'action décidée sur l'email via IMAP.
 * Retourne true si l'action a été appliquée.
 */
async function appliquerAction(boite, email, action) {
  switch (action) {
    case 'supprimer':
      await supprimerEmail(boite, email.uid)
      return true
    case 'archiver':
      await archiverEmail(boite, email.uid)
      return true
    case 'marquer_lu':
      await marquerLu(boite, email.uid)
      return true
    case 'repondre':
    case 'lire':
    case 'ignorer':
      // Pas d'action IMAP — juste log
      return false
    default:
      return false
  }
}

/**
 * Point d'entrée principal.
 * Analyse et traite un email, enregistre le résultat dans EmailLog.
 */
export async function analyserEtAgir(boite, email) {
  // Récupérer le prompt global mail
  const promptGlobal = await getPrompt('mail', 'orchestrateur')

  let decision
  try {
    decision = await analyserEmail(email, boite, promptGlobal)
  } catch (err) {
    logError(`EVA mail: erreur analyse email UID ${email.uid} (${boite.email}) — ${err.message}`)
    // En cas d'erreur LLM : on log sans agir
    decision = {
      categorie: 'erreur',
      action: 'lire',
      raison: `Erreur analyse : ${err.message}`,
      brouillon: null
    }
  }

  // Appliquer l'action IMAP (sauf repondre/lire/ignorer)
  let actionAppliquee = false
  if (decision.action !== 'repondre' && decision.action !== 'lire' && decision.action !== 'ignorer') {
    try {
      actionAppliquee = await appliquerAction(boite, email, decision.action)
    } catch (err) {
      logError(`EVA mail: erreur application action "${decision.action}" UID ${email.uid} — ${err.message}`)
      decision.raison += ` [erreur application : ${err.message}]`
    }
  }

  // Enregistrer dans EmailLog
  const log = await prisma.emailLog.create({
    data: {
      boiteMailId: boite.id,
      uid: email.uid,
      sujet: email.sujet,
      expediteur: email.expediteur,
      corps: email.corps?.substring(0, 500) || null,
      dossier: email.dossier || 'INBOX',
      categorie: decision.categorie,
      action: decision.action,
      raison: decision.raison,
      actionAppliquee,
      brouillon: decision.brouillon || null,
      brouillonEnvoye: false
    }
  })

  logAction(`EVA mail: ${boite.email} — UID ${email.uid} — ${decision.action} (${decision.categorie})`)
  return log
}
