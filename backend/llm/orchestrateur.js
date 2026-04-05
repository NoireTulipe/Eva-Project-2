import { callAI } from './providers.js'
import { getPrompt, resolvePromptTags, PROMPTS_DEFAUT, VALEURS_TAGS_DEVELOPPEUR } from './prompts.js'
import { getToolsDescription, executeTool } from '../tools/registry.js'
import { rechercheMemoire } from '../modules/memoire/recherche.js'
import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'

// ─── Pipeline principal ────────────────────────────────────────────────────────

/**
 * Mode conversation : appel direct au Pro sans Flash ni outils.
 * Utilisé pour les salons Discord en mode "conversation".
 */
export async function processConversation(message, context) {
  const now = new Date()
  const dateHeure = now.toLocaleString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

  const [redacteurRaw, config] = await Promise.all([
    getPrompt('redacteur', 'system'),
    getLLMConfig()
  ])

  const redacteurTemplate = redacteurRaw || PROMPTS_DEFAUT.redacteur.system
  const systemPrompt = resolvePromptTags(redacteurTemplate, {
    DATE_HEURE: dateHeure,
    MODELE_LLM: `${config.proProvider} / ${config.proModel}`
  })

  const memoireContext = await buildMemoireContext(message, context.userId)

  const conversationMessages = buildMessages(
    systemPrompt,
    context.history,
    `${memoireContext ? memoireContext.trim() + '\n\n' : ''}${context.userName} : ${message}`
  )

  const response = await callAI(config.proProvider, config.proModel, conversationMessages)

  logAction(`EVA: réponse générée via ${config.proProvider}/${config.proModel} (${response.length} chars)`)
  pushToBuffer(message, response, context).catch(err => logError(`pushToBuffer: ${err.message}`))
  return response
}

/**
 * Traite un message utilisateur via le pipeline EVA complet.
 * @param {string} message
 * @param {object} context - { userId, userName, history }
 * @param {object} options - { categories: string[]|null }
 * @returns {Promise<string>}
 */
export async function processMessage(message, context, options = {}) {
  const { categories = null } = options
  const now = new Date()
  const dateHeure = now.toLocaleString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

  // 1. Charger les prompts, la config LLM et la mémoire en parallèle
  const [orchestratorRaw, redacteurRaw, config, memoireContext] = await Promise.all([
    getPrompt('orchestrateur', 'system'),
    getPrompt('redacteur', 'system'),
    getLLMConfig(),
    buildMemoireContext(message, context.userId)
  ])

  // 2. Résoudre les tags du prompt orchestrateur
  const orchestratorTemplate = orchestratorRaw || PROMPTS_DEFAUT.orchestrateur.system
  const orchestratorPrompt = resolvePromptTags(orchestratorTemplate, {
    TOOLS: getToolsDescription(categories),
    DATE_HEURE: dateHeure,
    REGLES_MEMOIRE: VALEURS_TAGS_DEVELOPPEUR.REGLES_MEMOIRE
  })

  // 3. Résoudre les tags du prompt rédacteur
  const redacteurTemplate = redacteurRaw || PROMPTS_DEFAUT.redacteur.system
  const redacteurPrompt = resolvePromptTags(redacteurTemplate, {
    DATE_HEURE: dateHeure,
    MODELE_LLM: `${config.proProvider} / ${config.proModel}`
  })

  // 4. Construire le tableau de messages (system + historique structuré + message actuel)
  const orchestratorMessages = buildMessages(
    orchestratorPrompt,
    context.history,
    `${dateHeure}${memoireContext}\n\nMessage de ${context.userName} : ${message}`
  )

  // 5. Appel orchestrateur (Flash)
  const rawResponse = await callAI(config.provider, config.flashModel, orchestratorMessages)

  // 6. Parser le plan JSON
  let plan
  try {
    let cleaned = rawResponse.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    }
    plan = JSON.parse(cleaned)
  } catch {
    logAction(`EVA: réponse directe non-JSON (${rawResponse.length} chars)`)
    await pushToBuffer(message, rawResponse, context)
    return rawResponse
  }

  // 7. Réponse directe sans outils
  if (!plan.actions || plan.actions.length === 0) {
    const response = plan.reponse_directe || rawResponse
    await pushToBuffer(message, response, context)
    return response
  }

  // 8. Exécuter les outils
  logAction(`EVA: exécution ${plan.actions.length} outil(s) — ${plan.intention}`)

  const results = await Promise.allSettled(
    plan.actions.map(action =>
      executeTool(action.tool, action.params || {}, context, categories)
        .then(result => ({ tool: action.tool, raison: action.raison, result }))
        .catch(err => ({ tool: action.tool, raison: action.raison, result: { error: err.message } }))
    )
  )

  const toolResults = results.map(r => r.value || r.reason)

  // 9. Appel rédacteur (Pro) pour synthèse finale
  // La synthèse est un appel one-shot : le système + le contexte outils suffisent.
  // L'historique récent est inclus pour que la réponse soit cohérente avec le fil.
  const writerUserPrompt = `${context.userName} a demandé : "${message}"

Résultats des outils exécutés :
${toolResults.map((r, i) => `${i + 1}. [${r.tool}] ${JSON.stringify(r.result, null, 2)}`).join('\n\n')}

Rédige une réponse naturelle et concise basée sur ces résultats.`

  const writerMessages = buildMessages(redacteurPrompt, context.history, writerUserPrompt)
  const finalResponse = await callAI(config.proProvider, config.proModel, writerMessages)

  pushToBuffer(message, finalResponse, context).catch(err =>
    logError(`pushToBuffer: ${err.message}`)
  )

  logAction(`EVA: réponse générée via ${config.proProvider}/${config.proModel} (${finalResponse.length} chars)`)
  return finalResponse
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Construit le tableau de messages pour callAI :
 * system + historique structuré (alternance user/assistant) + message actuel.
 * Garantit que l'historique commence par un message user (requis par Gemini).
 */
function buildMessages(systemPrompt, history, currentUserContent) {
  const messages = [{ role: 'system', content: systemPrompt }]

  if (history?.length) {
    // S'assurer que l'historique commence par 'user' (alternance stricte Gemini)
    let recent = history.slice(-10)
    if (recent[0]?.role !== 'user') recent = recent.slice(1)

    for (const m of recent) {
      messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })
    }
  }

  messages.push({ role: 'user', content: currentUserContent })
  return messages
}

async function getLLMConfig() {
  const params = await prisma.configParam.findMany({
    where: { cle: { in: ['llm.provider', 'llm.flash_model', 'llm.pro_model', 'llm.pro_provider'] } }
  })
  const map = Object.fromEntries(params.map(p => [p.cle, p.valeur]))
  return {
    provider: map['llm.provider'] || 'gemini',
    flashModel: map['llm.flash_model'] || 'gemini-2.5-flash',
    proModel: map['llm.pro_model'] || 'gemini-2.5-pro',
    proProvider: map['llm.pro_provider'] || map['llm.provider'] || 'gemini'
  }
}

async function pushToBuffer(message, response, context) {
  await prisma.memBuffer.create({
    data: {
      source: `web:${context.userId}`,
      contenu: `${context.userName}: ${message}\nEVA: ${response}`
    }
  })
}

/**
 * Construit le bloc mémoire injecté dans le message utilisateur.
 * Recherche sémantique sur le message + préférences récentes.
 */
async function buildMemoireContext(message, userId) {
  try {
    const [semantique, preferences] = await Promise.all([
      rechercheMemoire(message, userId),
      prisma.memPreference.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { cle: true, contenu: true }
      })
    ])

    const lines = []

    if (preferences.length > 0) {
      lines.push('\nPRÉFÉRENCES CONNUES :')
      for (const p of preferences) {
        lines.push(`  • ${p.cle} : ${p.contenu}`)
      }
    }

    if (semantique.length > 0) {
      lines.push('MÉMOIRE PERTINENTE :')
      for (const r of semantique) {
        if (r.type === 'souvenir') lines.push(`  • [souvenir] ${r.contenu}`)
        else if (r.type === 'preference') lines.push(`  • [préférence] ${r.cle} : ${r.contenu}`)
        else if (r.type === 'contact') lines.push(`  • [contact] ${r.nom} : ${r.contenu}`)
      }
    }

    return lines.length > 0 ? '\n\n' + lines.join('\n') : ''
  } catch {
    return ''
  }
}
