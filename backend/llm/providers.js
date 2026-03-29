import { GoogleGenerativeAI } from '@google/generative-ai'
import { Mistral } from '@mistralai/mistralai'
import { logError } from '../logs/logger.js'

// Initialisation paresseuse — les clients sont créés au premier appel,
// après que dotenv ait chargé les variables d'environnement.
let geminiClient = null
let mistralClient = null

function getGemini() {
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return geminiClient
}

function getMistral() {
  if (!mistralClient) {
    mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
  }
  return mistralClient
}

async function callGemini(modelName, messages) {
  const systemMsg = messages.find(m => m.role === 'system')
  const otherMsgs = messages.filter(m => m.role !== 'system')

  const modelOptions = { model: modelName }
  if (systemMsg) modelOptions.systemInstruction = systemMsg.content

  const model = getGemini().getGenerativeModel(modelOptions)

  const contents = otherMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  const result = await model.generateContent({ contents })
  return result.response.text()
}

async function callMistral(modelName, messages) {
  const client = getMistral()
  const response = await client.chat.complete({
    model: modelName,
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : m.role,
      content: m.content
    })),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7')
  })
  return response.choices[0].message.content || ''
}

/**
 * Appelle un LLM avec fallback automatique.
 * @param {string} provider - 'gemini' | 'mistral'
 * @param {string} modelName - Nom du modèle
 * @param {Array} messages - [{role: 'system'|'user'|'assistant', content: string}]
 * @returns {Promise<string>}
 */
export async function callAI(provider, modelName, messages) {
  try {
    if (provider === 'gemini') return await callGemini(modelName, messages)
    if (provider === 'mistral') return await callMistral(modelName, messages)
    throw new Error(`Provider inconnu : ${provider}`)
  } catch (err) {
    logError(`callAI ${provider}/${modelName}: ${err.message}`)

    const fallbackProvider = provider === 'gemini' ? 'mistral' : 'gemini'
    const fallbackModel = fallbackProvider === 'gemini'
      ? (process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash')
      : (process.env.MISTRAL_FLASH_MODEL || 'mistral-small-latest')

    logError(`Fallback vers ${fallbackProvider}/${fallbackModel}`)

    if (fallbackProvider === 'gemini') return await callGemini(fallbackModel, messages)
    return await callMistral(fallbackModel, messages)
  }
}
