import prisma from '../config/db.js'

const cache = new Map()

/**
 * Charge un prompt depuis la table Prompt (avec cache en mémoire).
 * Retourne le contenu si actif, null sinon.
 */
export async function getPrompt(module, role) {
  const key = `${module}:${role}`
  if (cache.has(key)) return cache.get(key)

  const p = await prisma.prompt.findUnique({
    where: { module_role: { module, role } }
  })

  if (p?.actif) {
    cache.set(key, p.contenu)
    return p.contenu
  }

  return null
}

/** Vide le cache (à appeler après modification d'un prompt en admin). */
export function invalidatePromptCache() {
  cache.clear()
}

/**
 * Résout tous les {{TAGS}} d'un template avec les valeurs fournies.
 * Les tags non fournis restent tels quels (pas de remplacement silencieux).
 * @param {string} template
 * @param {Record<string, string>} vars - ex: { TOOLS: '...', DATE_HEURE: '...' }
 * @returns {string}
 */
export function resolvePromptTags(template, vars) {
  return Object.entries(vars).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '')
  }, template)
}

// ─── Définition des tags disponibles par module ───────────────────────────────
// Cette constante est la référence unique pour le frontend et la preview.

export const TAGS_PAR_MODULE = {
  orchestrateur: [
    {
      tag: '{{TOOLS}}',
      description: 'Liste des outils disponibles avec leurs paramètres et descriptions',
      exemple: '- get_produits(actif: boolean): Récupère les produits du catalogue\n- recall_info(query: string): Recherche dans la mémoire...'
    },
    {
      tag: '{{DATE_HEURE}}',
      description: 'Date et heure actuelles au format français (Europe/Paris)',
      exemple: 'dimanche 30 mars 2026, 14:32'
    },
    {
      tag: '{{REGLES_MEMOIRE}}',
      description: 'Bloc de règles d\'utilisation de la mémoire long terme (contrôlé par le développeur)',
      exemple: 'MÉMOIRE LONG TERME :\nSi le message contient une section "PRÉFÉRENCES CONNUES" ou "MÉMOIRE PERTINENTE", tu DOIS utiliser ces informations pour répondre...'
    }
  ],
  redacteur: [
    {
      tag: '{{DATE_HEURE}}',
      description: 'Date et heure actuelles au format français',
      exemple: 'dimanche 30 mars 2026, 14:32'
    },
    {
      tag: '{{MODELE_LLM}}',
      description: 'Provider et modèle LLM actif pour le rédacteur',
      exemple: 'gemini / gemini-2.5-pro'
    }
  ],
  consolidation: [
    {
      tag: '{{ECHANGES}}',
      description: 'Les échanges du buffer mémoire à analyser et consolider',
      exemple: 'Utilisateur: Je travaille sur un roman policier.\nEVA: Super, tu veux de l\'aide ?\n---\nUtilisateur: Mon auteur préféré est Fred Vargas...'
    }
  ]
}

// ─── Valeurs par défaut des prompts (référence + fallback si DB inactive) ─────
// Modifier ici UNIQUEMENT les valeurs par défaut.
// Ces valeurs sont aussi utilisées par l'endpoint "reset to default".

export const PROMPTS_DEFAUT = {
  orchestrateur: {
    system: `Tu es EVA, une assistante IA personnelle et professionnelle pour une Maison d'Édition.
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

{{REGLES_MEMOIRE}}

RÈGLES D'UTILISATION :
- Utilise les outils dès que la demande porte sur des données (stock, ventes, sessions, recherche web).
- Si l'utilisateur partage une information personnelle → utilise remember_info automatiquement.
- Si une question nécessite une recherche → utilise search_web.
- Plusieurs outils peuvent être appelés en parallèle dans le tableau "actions".
- Ne dis JAMAIS "je vais faire X" sans avoir mis l'outil dans les actions.
- Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.`
  },

  redacteur: {
    system: `Tu es EVA, une assistante IA chaleureuse et précise pour une Maison d'Édition.
Rédige une réponse naturelle et concise basée sur les résultats fournis.
Sois directe et utile. Parle des résultats, pas de tes actions.
N'utilise pas de markdown excessif — du texte clair est préférable.
Modèle actif : {{MODELE_LLM}}`
  },

  consolidation: {
    system: `Tu es un système d'extraction de mémoire. Analyse ces échanges et extrais les informations importantes sur l'utilisateur.

RÈGLE ABSOLUE : Réponds UNIQUEMENT en JSON valide, rien d'autre.

Format de réponse :
{
  "souvenirs": ["fait important sur l'utilisateur ou un événement notable"],
  "preferences": [{"cle": "clé_courte", "contenu": "description de la préférence"}],
  "contacts": [
    {
      "nom": "Prénom Nom",
      "contenu": "ce qu'on sait de cette personne",
      "relations": ["type_de_relation"]
    }
  ]
}

Pour le champ "relations" d'un contact : indique le ou les types de relation avec l'utilisateur.
Utilise des termes simples et génériques : "famille", "ami", "collègue", "travail", "médecin", "voisin", etc.
Si le contexte implique la maison d'édition ou une activité professionnelle éditoriale, ajoute le nom pertinent (ex: "Echo de Plumes").
Si la relation est inconnue, laisse le tableau vide [].

Si rien de mémorisable → {"souvenirs": [], "preferences": [], "contacts": []}

N'extrais que ce qui est réellement significatif. Ignore les questions banales et les réponses génériques.

ÉCHANGES À ANALYSER :
{{ECHANGES}}`
  }
}

// ─── Valeurs résolues pour les tags développeur ───────────────────────────────
// Contenu injecté pour chaque tag contrôlé par le développeur.
// Le tag {{TOOLS}} est résolu dynamiquement — pas ici.

export const VALEURS_TAGS_DEVELOPPEUR = {
  REGLES_MEMOIRE: `MÉMOIRE LONG TERME :
Si le message contient une section "PRÉFÉRENCES CONNUES" ou "MÉMOIRE PERTINENTE", ces informations proviennent de ta mémoire persistante.
Tu DOIS les utiliser pour répondre — ne les ignore jamais.
Si la mémoire contient la réponse à la question posée, réponds directement via "reponse_directe" sans appeler d'outil.`
}
