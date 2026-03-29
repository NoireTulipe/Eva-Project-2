import { callAI } from './providers.js'
import { getPrompt } from './prompts.js'
import { getToolsDescription, executeTool } from '../tools/registry.js'
import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'

// ─── Prompts par défaut (utilisés si absent de la DB) ─────────────────────────

const DEFAULT_ORCHESTRATOR = `Tu es EVA, une assistante IA personnelle et professionnelle pour une Maison d'Édition.
Tu es intelligente, fiable, directe et légèrement chaleureuse.

RÈGLE ABSOLUE : Tu réponds UNIQUEMENT en JSON valide. Jamais de texte libre, jamais de markdown.

FORMAT obligatoire quand des outils sont nécessaires :
{
  "intention": "description claire de la demande",
  "actions": [
    { "tool": "nom_outil_exact", "params": { ... }, "raison": "pourquoi cet outil" }
  ]
}

FORMAT obligatoire quand aucun outil n'est nécessaire :
{
  "intention": "description",
  "actions": [],
  "reponse_directe": "ta réponse conversationnelle ici"
}

OUTILS DISPONIBLES :
{{TOOLS}}

RÈGLES D'UTILISATION :
- Utilise les outils dès que la demande porte sur des données (stock, ventes, sessions, recherche web).
- Si l'utilisateur partage une information personnelle → utilise remember_info automatiquement.
- Si une question nécessite une recherche → utilise search_web.
- Plusieurs outils peuvent être appelés en parallèle dans le tableau "actions".
- Ne dis JAMAIS "je vais faire X" sans avoir mis l'outil dans les actions.
- Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.`

const DEFAULT_REDACTEUR = `Tu es EVA, une assistante IA chaleureuse et précise.
Rédige une réponse naturelle et concise basée sur les résultats fournis.
Sois directe et utile. Parle des résultats, pas de tes actions.
N'utilise pas de markdown excessif — du texte clair est préférable.`

// ─── Pipeline principal ────────────────────────────────────────────────────────

/**
 * Mode conversation : appel direct au Pro sans Flash ni outils.
 * Utilisé pour les salons Discord en mode "conversation".
 * @param {string} message
 * @param {object} context - { userId, userName, history }
 * @returns {Promise<string>}
 */
export async function processConversation(message, context) {
  const now = new Date()
  const dateInfo = `Date et heure : ${now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`

  const [redacteurRaw, config] = await Promise.all([
    getPrompt('redacteur', 'system'),
    getLLMConfig()
  ])
  const systemPrompt = redacteurRaw || DEFAULT_REDACTEUR

  // Mémoire récente depuis MemBuffer
  const recentBuffer = await prisma.memBuffer.findMany({
    where: { source: { startsWith: `discord:${context.userId}` } },
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  const memoryText = recentBuffer.length
    ? '\nMÉMOIRE RÉCENTE :\n' + recentBuffer.reverse().map(b => b.contenu).join('\n---\n')
    : ''

  const historyText = context.history?.length
    ? '\nHISTORIQUE :\n' + context.history.slice(-6).map(m =>
        `${m.role === 'user' ? context.userName : 'EVA'}: ${m.content}`
      ).join('\n')
    : ''

  const prompt = `${systemPrompt}

${dateInfo}${memoryText}${historyText}

${context.userName} : ${message}`

  const response = await callAI(config.proProvider, config.proModel, [
    { role: 'user', content: prompt }
  ])

  pushToBuffer(message, response, context).catch(err => logError(`pushToBuffer: ${err.message}`))
  return response
}

/**
 * Traite un message utilisateur via le pipeline EVA.
 * @param {string} message - Le message de l'utilisateur
 * @param {object} context - { userId, userName, history: [{role, content}] }
 * @param {object} options - { categories: string[]|null } — filtre les outils disponibles
 * @returns {Promise<string>} La réponse finale
 */
export async function processMessage(message, context, options = {}) {
  const { categories = null } = options
  const now = new Date()
  const dateInfo = `Date et heure : ${now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}, ${now.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' })}`

  // 1. Charger les prompts et la config LLM
  const [orchestratorRaw, redacteurRaw, config] = await Promise.all([
    getPrompt('orchestrateur', 'system'),
    getPrompt('redacteur', 'system'),
    getLLMConfig()
  ])

  const orchestratorPrompt = (orchestratorRaw || DEFAULT_ORCHESTRATOR)
    .replace('{{TOOLS}}', getToolsDescription(categories))
  const redacteurPrompt = redacteurRaw || DEFAULT_REDACTEUR

  // 2. Construire le contexte historique
  const historyText = context.history?.length
    ? '\nHISTORIQUE RÉCENT :\n' + context.history
        .slice(-8)
        .map(m => `${m.role === 'user' ? context.userName : 'EVA'}: ${m.content}`)
        .join('\n')
    : ''

  // 3. Appel orchestrateur (Flash)
  const userPrompt = `${dateInfo}${historyText}

Message de ${context.userName} : ${message}`

  const flashMessages = [
    { role: 'system', content: orchestratorPrompt },
    { role: 'user', content: userPrompt }
  ]

  const rawResponse = await callAI(config.provider, config.flashModel, flashMessages)

  // 4. Parser le plan JSON
  let plan
  try {
    let cleaned = rawResponse.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    }
    plan = JSON.parse(cleaned)
  } catch {
    // Réponse non-JSON → retourner tel quel
    logAction(`EVA: réponse directe non-JSON (${rawResponse.length} chars)`)
    await pushToBuffer(message, rawResponse, context)
    return rawResponse
  }

  // 5. Réponse directe sans outils
  if (!plan.actions || plan.actions.length === 0) {
    const response = plan.reponse_directe || rawResponse
    await pushToBuffer(message, response, context)
    return response
  }

  // 6. Exécuter les outils
  logAction(`EVA: exécution ${plan.actions.length} outil(s) — ${plan.intention}`)

  const results = await Promise.allSettled(
    plan.actions.map(action =>
      executeTool(action.tool, action.params || {}, context, categories)
        .then(result => ({ tool: action.tool, raison: action.raison, result }))
        .catch(err => ({ tool: action.tool, raison: action.raison, result: { error: err.message } }))
    )
  )

  const toolResults = results.map(r => r.value || r.reason)

  // 7. Appel rédacteur (Pro) pour synthèse finale
  const writerPrompt = `${redacteurPrompt}

${dateInfo}

${context.userName} a demandé : "${message}"

Résultats des outils exécutés :
${toolResults.map((r, i) => `${i + 1}. [${r.tool}] ${JSON.stringify(r.result, null, 2)}`).join('\n\n')}

Rédige une réponse naturelle et concise basée sur ces résultats.`

  const finalResponse = await callAI(config.proProvider, config.proModel, [
    { role: 'user', content: writerPrompt }
  ])

  // 8. Mémoriser l'échange (async, sans bloquer)
  pushToBuffer(message, finalResponse, context).catch(err =>
    logError(`pushToBuffer: ${err.message}`)
  )

  logAction(`EVA: réponse générée (${finalResponse.length} chars)`)
  return finalResponse
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
