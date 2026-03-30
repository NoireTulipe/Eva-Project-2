import { ventesTools } from './categories/ventes.tools.js'
import { memoireTools } from './categories/memoire.tools.js'
import { webTools } from './categories/web.tools.js'
import { rechercheTools } from './categories/recherche.tools.js'
import { mailTools } from './categories/mail.tools.js'

const ALL_TOOLS = [...ventesTools, ...memoireTools, ...webTools, ...rechercheTools, ...mailTools]

/**
 * Retourne la description textuelle des outils pour injection dans le prompt.
 * @param {string[]|null} categories - Si fourni, filtre sur ces catégories uniquement
 */
export function getToolsDescription(categories = null) {
  const tools = categories
    ? ALL_TOOLS.filter(t => categories.includes(t.category))
    : ALL_TOOLS

  return tools.map(t => {
    const props = t.parameters?.properties || {}
    const params = Object.entries(props)
      .map(([k, v]) => `${k}: ${v.type}${v.description ? ` (${v.description})` : ''}`)
      .join(', ')
    return `- ${t.name}(${params}): ${t.description}`
  }).join('\n')
}

/**
 * Exécute un outil par son nom.
 * @param {string} name - Nom de l'outil
 * @param {object} args - Arguments
 * @param {object} context - Contexte utilisateur {userId, userName}
 * @param {string[]|null} categories - Si fourni, vérifie que l'outil est autorisé
 */
export async function executeTool(name, args, context, categories = null) {
  const tool = ALL_TOOLS.find(t => t.name === name)
  if (!tool) throw new Error(`Outil inconnu : ${name}`)
  if (categories && !categories.includes(tool.category)) {
    throw new Error(`Outil "${name}" non autorisé dans ce contexte`)
  }
  return await tool.execute(args || {}, context)
}
