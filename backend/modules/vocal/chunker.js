/**
 * chunker.js — Découpage intelligent de texte pour TTS
 *
 * Deux modes :
 *   - 'sentences' : regroupe N phrases par chunk
 *   - 'words'     : regroupe N mots par chunk
 *
 * Le découpage respecte les fins de phrase (. ! ? …) et ignore les abréviations
 * françaises courantes (M., Mme, Dr., etc.).
 * Sanitization : strip emoji, échappement caractères problématiques pour le shell.
 */

// Abréviations françaises courantes — ne pas couper après le point
const ABREVIATIONS = new Set([
  'm', 'mm', 'mme', 'mlle', 'mlles', 'dr', 'pr', 'me', 'mq', 'mr',
  'sr', 'j.-c', 'av', 'apr', 'env', 'env.', 'cf', 'etc', 'not',
  'n°', 'nº', 'réf', 'réf.', 'art', 'chap', 'ch', 'fig', 'ib', 'ibid',
  'id', 'op', 'cit', 'p', 'pp', 'sq', 'suiv', 'suiv.', 't', 'vol',
  'éd', 'éd.', 'ms', 'mss', 'anc', 'franç', 'fr', 'all', 'angl', 'lat',
  'nb', 'max', 'min', 'ds', 'approx', 'approx.', 'ex', 'ex.',
  // Prénoms abrégés
  'm', 'j', 'p', 'a', 'c', 'f', 'g', 'h', 'l', 'n', 'r', 's', 't', 'v'
])

/**
 * Découpe un texte en phrases.
 * Gère : . ! ? … suivis d'espace + majuscule ou guillemet.
 * Ignore les abréviations connues.
 */
function splitSentences(text) {
  const sentences = []
  let current = ''
  let i = 0

  while (i < text.length) {
    current += text[i]

    // Fin de phrase potentielle ?
    if ('.!?…'.includes(text[i]) || (text[i] === '.' && (i + 1 >= text.length || /\s/.test(text[i + 1])))) {
      // Vérifier si c'est une abréviation
      const before = current.slice(0, -1).trimEnd()
      const lastWord = before.split(/\s+/).pop()?.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿñæœ.-]/g, '')

      // Si le dernier "mot" est une abréviation connue, ne pas couper
      const isAbbr = lastWord && ABREVIATIONS.has(lastWord)

      // Vérifier que ce qui suit est une fin de phrase (espace + majuscule/guillemet/début, ou fin de texte)
      let j = i + 1
      while (j < text.length && /[\s ]/.test(text[j])) j++

      const nextChar = j < text.length ? text[j] : null
      const isEnd = nextChar === null || /[A-ZÀÂÇÉÈÊËÎÏÔÖÙÛÜŸ"«"'']/.test(nextChar)

      if (!isAbbr && isEnd) {
        // Inclure la ponctuation de fin dans la phrase courante
        // Ajouter les guillemets fermants s'ils suivent immédiatement
        while (j < text.length && /[""»']/.test(text[j])) {
          current += text[j]
          i = j
          j++
        }
        sentences.push(current.trim())
        current = ''
        i = j
        continue
      }
    }

    i++
  }

  // Dernière phrase (sans ponctuation finale)
  const remaining = current.trim()
  if (remaining) sentences.push(remaining)

  return sentences
}

/**
 * Strip les emoji et caractères Unicode problématiques pour Piper.
 * Adapté de l'ancien ttsService.js d'EVA v1.
 */
function stripEmoji(text) {
  return text
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')  // Misc symbols, emoticons, emoji
    .replace(/[\u{2600}-\u{26FF}]/gu, '')     // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')     // Dingbats
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')     // Variation selectors
}

/**
 * Échappe les caractères qui posent problème dans un shell echo.
 */
function escapeForShell(text) {
  return text
    .replace(/\\/g, '\\\\')   // Backslash d'abord
    .replace(/"/g, '\\"')     // Guillemets doubles
    .replace(/`/g, '\\`')     // Backticks
    .replace(/\$/g, '\\$')    // Dollar sign (expansion shell)
    .replace(/\*/g, '\\*')    // Astérisque (glob)
    .replace(/&/g, '\\&')     // Esperluette (background process)
    .replace(/\|/g, '\\|')    // Pipe
    .replace(/;/g, '\\;')     // Point-virgule
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/~/g, '\\~')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
}

/**
 * Sanitize le texte complet : strip emoji + escape shell.
 */
export function sanitizeText(text) {
  return escapeForShell(stripEmoji(text))
}

/**
 * Filtre les artefacts de copier-coller courants :
 * numéros de page isolés, en-têtes de PDF, lignes vides multiples.
 */
function filterArtifacts(text) {
  return text
    // Supprimer les # de titre Markdown (ex: "# Chapitre 1" → "Chapitre 1")
    // et les remplacer par un double saut de ligne pour créer une pause naturelle
    .replace(/^#{1,6}\s+/gm, '\n\n')
    // Supprimer les numéros de page isolés (ligne ne contenant qu'un nombre)
    .replace(/^\d{1,4}\s*$/gm, '')
    // Supprimer les lignes "Page X sur Y"
    .replace(/^Page\s+\d+\s+(sur|de)\s+\d+\s*$/gim, '')
    // Réduire les sauts de ligne multiples à max 2
    .replace(/\n{3,}/g, '\n\n')
    // Supprimer les espaces insécables Unicode
    .replace(/ /g, ' ')
    .trim()
}

/**
 * Découpe un texte en chunks.
 *
 * @param {string}  text   - Texte à découper
 * @param {string}  mode   - 'sentences' | 'words'
 * @param {number}  size   - Nombre d'unités par chunk (défaut: 3 pour sentences, 100 pour words)
 * @returns {{ chunks: string[], totalChars: number, chunkCount: number, estimatedMinutes: number }}
 */
export function chunkText(text, mode = 'sentences', size = null) {
  const clean = filterArtifacts(text)

  if (!clean.trim()) {
    return { chunks: [], totalChars: 0, chunkCount: 0, estimatedMinutes: 0 }
  }

  let chunks = []

  if (mode === 'words') {
    const wordCount = size || 100
    const words = clean.split(/\s+/).filter(Boolean)

    for (let i = 0; i < words.length; i += wordCount) {
      const chunk = words.slice(i, i + wordCount).join(' ')
      if (chunk.trim()) chunks.push(chunk.trim())
    }
  } else {
    // mode 'sentences' (défaut)
    const sentCount = size || 3
    const sentences = splitSentences(clean)

    // Fallback : si splitSentences ne trouve aucune phrase (texte sans ponctuation),
    // découper par blocs de ~750 caractères
    if (sentences.length <= 1 && clean.length > 500) {
      const charLimit = 750
      for (let i = 0; i < clean.length; i += charLimit) {
        chunks.push(clean.slice(i, i + charLimit).trim())
      }
    } else {
      for (let i = 0; i < sentences.length; i += sentCount) {
        const chunk = sentences.slice(i, i + sentCount).join(' ')
        if (chunk.trim()) chunks.push(chunk.trim())
      }
    }
  }

  // Limite de sécurité : max 5000 caractères par chunk
  const MAX_CHUNK = 5000
  const safeChunks = []
  for (const chunk of chunks) {
    if (chunk.length <= MAX_CHUNK) {
      safeChunks.push(chunk)
    } else {
      // Sous-découper les chunks trop longs sur les limites de phrase si possible,
      // sinon couper brutalement
      const subSentences = splitSentences(chunk)
      if (subSentences.length > 1) {
        let acc = ''
        for (const s of subSentences) {
          if (acc.length + s.length > MAX_CHUNK && acc.length > 0) {
            safeChunks.push(acc.trim())
            acc = s
          } else {
            acc += (acc ? ' ' : '') + s
          }
        }
        if (acc.trim()) safeChunks.push(acc.trim())
      } else {
        // Couper brutalement par blocs
        for (let i = 0; i < chunk.length; i += MAX_CHUNK) {
          safeChunks.push(chunk.slice(i, i + MAX_CHUNK).trim())
        }
      }
    }
  }

  const totalChars = safeChunks.reduce((sum, c) => sum + c.length, 0)
  // Estimation : ~15 caractères par seconde de parole en français
  const estimatedMinutes = Math.ceil(totalChars / 15 / 60)

  return {
    chunks: safeChunks,
    totalChars,
    chunkCount: safeChunks.length,
    estimatedMinutes
  }
}
