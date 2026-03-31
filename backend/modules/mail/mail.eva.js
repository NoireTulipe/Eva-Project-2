import prisma from '../../config/db.js'
import { callAI } from '../../llm/providers.js'
import { getPrompt } from '../../llm/prompts.js'
import { supprimerEmail, archiverEmail, marquerLu, deplacerEmail } from './imap.service.js'
import { logAction, logError } from '../../logs/logger.js'
import { rechercheMemoire } from '../memoire/recherche.js'

// Actions reconnues par EVA
const ACTIONS_VALIDES = ['lire', 'archiver', 'supprimer', 'marquer_lu', 'repondre', 'ignorer', 'deplacer']

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
/**
 * Récupère les 20 dernières corrections humaines pour cette boîte,
 * formatées pour injection dans le prompt.
 */
/**
 * Récupère les règles mail depuis deux sources :
 * 1. Les 20 dernières corrections dans EmailLog (mémoire courte)
 * 2. La mémoire long terme via recherche sémantique (consolidations passées)
 */
async function getReglesApprisesmail(boiteId, emailSujet, userId) {
  // ── Mémoire courte : 20 dernières corrections pour cette boîte ──────────────
  const corrections = await prisma.emailLog.findMany({
    where: { boiteMailId: boiteId, corrige: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { sujet: true, expediteur: true, categorie: true, action: true, correctionAction: true, correctionRaison: true }
  })

  let bloc = ''

  if (corrections.length) {
    const lignes = corrections.map(c =>
      `- Mail "${c.sujet || '?'}" de ${c.expediteur || '?'} (${c.categorie}) : "${c.action}" → corrigé en "${c.correctionAction}"${c.correctionRaison ? ` (${c.correctionRaison})` : ''}`
    )
    bloc += `\n\n--- Corrections récentes (règles à appliquer) ---\n${lignes.join('\n')}`
  }

  // ── Mémoire long terme : souvenirs/préférences liés aux mails ───────────────
  if (userId) {
    try {
      const query = `règle mail correction ${emailSujet || 'email'}`
      const resultats = await rechercheMemoire(query, userId)
      const pertinents = resultats.filter(r => r.contenu.toLowerCase().includes('mail') || r.contenu.toLowerCase().includes('correction'))
      if (pertinents.length) {
        const lignes = pertinents.map(r => `- ${r.contenu}`)
        bloc += `\n\n--- Règles mémorisées long terme ---\n${lignes.join('\n')}`
      }
    } catch {
      // La mémoire long terme peut ne pas être disponible (embeddings non chargés)
    }
  }

  return bloc
}

async function analyserEmail(email, boite, promptGlobal, context = {}) {
  const { provider, model } = await getLLMConfig()

  const instructionBoite = boite.instructionSpecifique
    ? `\n\n--- Instructions spécifiques pour ${boite.nom} ---\n${boite.instructionSpecifique}`
    : ''

  const reglesApprises = await getReglesApprisesmail(boite.id, email.sujet, context?.userId)

  const systemPrompt = promptGlobal + instructionBoite + reglesApprises

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
  "action": "une parmi : lire | archiver | supprimer | marquer_lu | repondre | ignorer | deplacer",
  "dossierCible": "null OU chemin IMAP exact si action=deplacer (ex: 'Factures', 'Archive/2026')",
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
async function appliquerAction(boite, email, action, dossierCible) {
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
    case 'deplacer':
      if (!dossierCible) throw new Error('dossierCible requis pour action deplacer')
      await deplacerEmail(boite, email.uid, dossierCible)
      return true
    case 'repondre':
    case 'lire':
    case 'ignorer':
      return false
    default:
      return false
  }
}

/**
 * Point d'entrée principal.
 * Analyse et traite un email, enregistre le résultat dans EmailLog.
 */
export async function analyserEtAgir(boite, email, context = {}) {
  // Récupérer le prompt global mail
  const promptGlobal = await getPrompt('mail', 'orchestrateur')

  let decision
  try {
    decision = await analyserEmail(email, boite, promptGlobal, context)
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
      actionAppliquee = await appliquerAction(boite, email, decision.action, decision.dossierCible)
    } catch (err) {
      logError(`EVA mail: erreur application action "${decision.action}" UID ${email.uid} — ${err.message}`)
      decision.raison += ` [erreur application : ${err.message}]`
    }
  }

  // Enregistrer dans EmailLog
  // La raison inclut le dossier cible si action=deplacer
  const raisonComplete = decision.action === 'deplacer' && decision.dossierCible
    ? `${decision.raison} → dossier : ${decision.dossierCible}`
    : decision.raison

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
      raison: raisonComplete,
      actionAppliquee,
      brouillon: decision.brouillon || null,
      brouillonEnvoye: false
    }
  })

  logAction(`EVA mail: ${boite.email} — UID ${email.uid} — ${decision.action} (${decision.categorie})`)
  return log
}
