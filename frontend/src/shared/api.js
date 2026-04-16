const BASE = '/api'

// --- Gestion tokens ---

function getToken() {
  return localStorage.getItem('token')
}

function getRefreshToken() {
  return localStorage.getItem('refresh')
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

function isLoggedIn() {
  return !!getToken()
}

function saveTokens({ token, refresh, user }) {
  if (token) localStorage.setItem('token', token)
  if (refresh) localStorage.setItem('refresh', refresh)
  if (user) localStorage.setItem('user', JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh')
  localStorage.removeItem('user')
}

function logout() {
  clearSession()
  window.location.href = '/login'
}

// --- Client HTTP central ---

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  if (res.status === 401) {
    // Tenter un refresh
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      // Seulement rediriger si l'utilisateur était connecté (token présent)
      if (getToken()) logout()
      throw new Error('Non authentifié')
    }

    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })

    if (!refreshRes.ok) { logout(); return }

    const data = await refreshRes.json()
    saveTokens({ token: data.token })

    // Retry la requête originale avec le nouveau token
    const retryRes = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...headers, 'Authorization': `Bearer ${data.token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })

    if (!retryRes.ok) {
      const err = await retryRes.json().catch(() => ({}))
      throw new Error(err.error || `Erreur ${retryRes.status}`)
    }

    return retryRes.json()
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Erreur ${res.status}`)
  }

  // Réponses sans corps (204)
  if (res.status === 204) return null
  return res.json()
}

// --- Auth ---

export const auth = {
  getToken,
  getUser,
  isLoggedIn,
  logout,

  async login(email, password) {
    const data = await request('POST', '/auth/login', { email, password })
    saveTokens({ token: data.token, refresh: data.refreshToken, user: data.user })
    return data
  },

  async refresh(refreshToken) {
    return request('POST', '/auth/refresh', { refreshToken })
  }
}

// --- Images ---

export function getThumbUrl(imageUrl) {
  if (!imageUrl) return null
  const filename = imageUrl.split('/').pop().replace(/\.[^.]+$/, '.jpg')
  return `/uploads/thumb/${filename}`
}

// --- Produits ---

export const produits = {
  getAll: () => request('GET', '/ventes/produits'),
  getById: (id) => request('GET', `/ventes/produits/${id}`),
  getStock: (id) => request('GET', `/ventes/produits/${id}/stock`),
  create: (data) => request('POST', '/ventes/produits', data),
  update: (id, data) => request('PUT', `/ventes/produits/${id}`, data),
  remove: (id) => request('DELETE', `/ventes/produits/${id}`),
  uploadImage: async (id, file) => {
    const formData = new FormData()
    formData.append('image', file)
    const token = getToken()
    const res = await fetch(`${BASE}/ventes/produits/${id}/image`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Erreur ${res.status}`) }
    return res.json()
  },
  deleteImage: (id) => request('DELETE', `/ventes/produits/${id}/image`)
}

// --- Points de vente ---

export const pdv = {
  getAll: () => request('GET', '/ventes/pdv'),
  create: (data) => request('POST', '/ventes/pdv', data),
  update: (id, data) => request('PUT', `/ventes/pdv/${id}`, data)
}

// --- Sessions ---

export const sessions = {
  getAll: ({ limit = 20, offset = 0 } = {}) => request('GET', `/ventes/sessions?limit=${limit}&offset=${offset}`),
  open: (pointDeVenteId, debut) => request('POST', '/ventes/sessions', { pointDeVenteId, debut }),
  getById: (id) => request('GET', `/ventes/sessions/${id}`),
  cloturer: (id, fin = null) => request('POST', `/ventes/sessions/${id}/cloturer`, fin ? { fin } : {}),
  supprimer: (id) => request('DELETE', `/ventes/sessions/${id}`),
  rouvrir: (id) => request('POST', `/ventes/sessions/${id}/rouvrir`)
}

// --- Référentiels ---

export const ref = {
  getAll: (table) => request('GET', `/ref/${table}`),
  create: (table, nom) => request('POST', `/ref/${table}`, { nom }),
  update: (table, id, nom) => request('PUT', `/ref/${table}/${id}`, { nom }),
  remove: (table, id) => request('DELETE', `/ref/${table}/${id}`)
}

// --- Ventes ---

export const ventes = {
  enregistrer: (data) => request('POST', '/ventes/ventes', data),
  annuler: (id) => request('POST', `/ventes/ventes/${id}/annuler`)
}

// --- Frais ---

export const frais = {
  getAll: ({ debut, fin } = {}) => {
    const params = new URLSearchParams()
    if (debut) params.set('debut', debut)
    if (fin) params.set('fin', fin)
    const qs = params.toString()
    return request('GET', `/ventes/frais${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('POST', '/ventes/frais', data),
  ajouterSession: (sessionId, data) => request('POST', `/ventes/sessions/${sessionId}/frais`, data),
  remove: (id) => request('DELETE', `/ventes/frais/${id}`)
}

// --- Pertes ---

export const pertes = {
  getAll: ({ debut, fin } = {}) => {
    const params = new URLSearchParams()
    if (debut) params.set('debut', debut)
    if (fin) params.set('fin', fin)
    const qs = params.toString()
    return request('GET', `/ventes/pertes${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('POST', '/ventes/pertes', data),
  remove: (id) => request('DELETE', `/ventes/pertes/${id}`)
}

// --- Auteurs ---

export const auteurs = {
  getAll: () => request('GET', '/ventes/auteurs'),
  create: (data) => request('POST', '/ventes/auteurs', data),
  update: (id, data) => request('PUT', `/ventes/auteurs/${id}`, data),
  remove: (id) => request('DELETE', `/ventes/auteurs/${id}`),
  setForProduit: (produitId, auteurIds) => request('PUT', `/ventes/produits/${produitId}/auteurs`, { auteurIds })
}

// --- Dépôts ---

export const depots = {
  getAll: ({ pdvId } = {}) => {
    const params = new URLSearchParams()
    if (pdvId) params.set('pdvId', pdvId)
    const qs = params.toString()
    return request('GET', `/ventes/depots${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('POST', '/ventes/depots', data),
  retour: (id, quantite) => request('POST', `/ventes/depots/${id}/retour`, { quantite })
}

// --- Admin ---

export const admin = {
  // Prompts
  getPrompts: () => request('GET', '/admin/prompts'),
  updatePrompt: (id, data) => request('PUT', `/admin/prompts/${id}`, data),
  previewPrompt: (id, contenu) => request('POST', `/admin/prompts/${id}/preview`, { contenu }),
  resetPrompt: (id) => request('POST', `/admin/prompts/${id}/reset`),
  getPromptTags: () => request('GET', '/admin/prompts/tags'),

  // Config LLM
  getConfig: () => request('GET', '/admin/config'),
  updateConfig: (id, valeur) => request('PUT', `/admin/config/${id}`, { valeur }),

  // Discord canaux
  getCanaux: () => request('GET', '/admin/discord/canaux'),
  createCanal: (data) => request('POST', '/admin/discord/canaux', data),
  updateCanal: (id, data) => request('PUT', `/admin/discord/canaux/${id}`, data),
  deleteCanal: (id) => request('DELETE', `/admin/discord/canaux/${id}`),

  // Logs
  getLogs: (fichier = 'actions', lignes = 200) =>
    request('GET', `/admin/logs?fichier=${fichier}&lignes=${lignes}`),
  clearLogs: (fichier = 'actions') =>
    request('DELETE', `/admin/logs?fichier=${fichier}`),

  // Utilisateurs
  getUtilisateurs: () => request('GET', '/admin/utilisateurs'),
  updateUtilisateur: (id, data) => request('PUT', `/admin/utilisateurs/${id}`, data),

  // Crons
  getCrons: () => request('GET', '/admin/crons'),
  updateCron: (id, data) => request('PUT', `/admin/crons/${id}`, data),
  runCron: (id) => request('POST', `/admin/crons/${id}/run`),

  // Sauvegardes
  getSauvegardeInfo: () => request('GET', '/admin/sauvegardes/info'),
  createSauvegarde: () => request('POST', '/admin/sauvegardes/backup'),
  getSauvegardeListe: () => request('GET', '/admin/sauvegardes/liste'),
  restoreSauvegarde: (fichier) => request('POST', `/admin/sauvegardes/restore/${encodeURIComponent(fichier)}`),

  // Système
  getSystemeStatus: () => request('GET', '/admin/systeme/status'),
  restart: () => request('POST', '/admin/systeme/restart')
}

// --- Notes & Rappels ---

export const notes = {
  getAll: () => request('GET', '/notes'),
  create: (data) => request('POST', '/notes', data),
  update: (id, data) => request('PUT', `/notes/${id}`, data),
  remove: (id) => request('DELETE', `/notes/${id}`)
}

// --- EVA ---

export const eva = {
  chat: (message, conversationId = null) =>
    request('POST', '/eva/chat', { message, conversationId })
}

// --- Conversations ---

export const conversations = {
  getAll: () => request('GET', '/conversations'),
  create: (titre) => request('POST', '/conversations', { titre }),
  getById: (id) => request('GET', `/conversations/${id}`),
  rename: (id, titre) => request('PUT', `/conversations/${id}`, { titre }),
  remove: (id) => request('DELETE', `/conversations/${id}`)
}

// --- Mémoire ---

export const memoire = {
  getStats: () => request('GET', '/memoire/stats'),

  // Souvenirs
  getSouvenirs: () => request('GET', '/memoire/souvenirs'),
  createSouvenir: (contenu) => request('POST', '/memoire/souvenirs', { contenu }),
  updateSouvenir: (id, contenu) => request('PUT', `/memoire/souvenirs/${id}`, { contenu }),
  deleteSouvenir: (id) => request('DELETE', `/memoire/souvenirs/${id}`),

  // Préférences
  getPreferences: () => request('GET', '/memoire/preferences'),
  createPreference: (cle, contenu) => request('POST', '/memoire/preferences', { cle, contenu }),
  updatePreference: (id, data) => request('PUT', `/memoire/preferences/${id}`, data),
  deletePreference: (id) => request('DELETE', `/memoire/preferences/${id}`),

  // Contacts
  getContacts: () => request('GET', '/memoire/contacts'),
  createContact: (nom, contenu) => request('POST', '/memoire/contacts', { nom, contenu }),
  updateContact: (id, data) => request('PUT', `/memoire/contacts/${id}`, data),
  deleteContact: (id) => request('DELETE', `/memoire/contacts/${id}`),
  addContactRelation: (contactId, relationId) => request('POST', `/memoire/contacts/${contactId}/relations`, { relationId }),
  removeContactRelation: (contactId, relId) => request('DELETE', `/memoire/contacts/${contactId}/relations/${relId}`),
  addContactSouvenir: (contactId, souvenirId) => request('POST', `/memoire/contacts/${contactId}/souvenirs`, { souvenirId }),
  removeContactSouvenir: (contactId, souvenirId) => request('DELETE', `/memoire/contacts/${contactId}/souvenirs/${souvenirId}`),

  // Relations
  getRelations: () => request('GET', '/memoire/relations'),
  createRelation: (nom, description) => request('POST', '/memoire/relations', { nom, description }),
  updateRelation: (id, data) => request('PUT', `/memoire/relations/${id}`, data),
  deleteRelation: (id) => request('DELETE', `/memoire/relations/${id}`),

  // Buffer
  getBuffer: (traite) => {
    const qs = traite !== undefined ? `?traite=${traite}` : ''
    return request('GET', `/memoire/buffer${qs}`)
  },
  deleteBufferEntry: (id) => request('DELETE', `/memoire/buffer/${id}`),
  clearBuffer: (traite) => {
    const qs = traite !== undefined ? `?traite=${traite}` : ''
    return request('DELETE', `/memoire/buffer${qs}`)
  },

  // Outils
  recherche: (query) => request('POST', '/memoire/recherche', { query }),
  consolider: () => request('POST', '/memoire/consolider')
}

// --- Comptabilité ---

export const compta = {
  getRecap: ({ debut, fin } = {}) => {
    const params = new URLSearchParams()
    if (debut) params.set('debut', debut)
    if (fin) params.set('fin', fin)
    const qs = params.toString()
    return request('GET', `/ventes/compta${qs ? `?${qs}` : ''}`)
  },
  getDroitsAuteur: ({ debut, fin } = {}) => {
    const params = new URLSearchParams()
    if (debut) params.set('debut', debut)
    if (fin) params.set('fin', fin)
    const qs = params.toString()
    return request('GET', `/ventes/droits-auteur${qs ? `?${qs}` : ''}`)
  }
}

// --- Mail ---

export const mail = {
  // Boîtes
  getBoites: () => request('GET', '/mail/boites'),
  createBoite: (data) => request('POST', '/mail/boites', data),
  updateBoite: (id, data) => request('PUT', `/mail/boites/${id}`, data),
  deleteBoite: (id) => request('DELETE', `/mail/boites/${id}`),
  testBoite: (id) => request('POST', `/mail/boites/${id}/test`),
  getEmails: (id) => request('GET', `/mail/boites/${id}/emails`),
  getDossiers: (id) => request('GET', `/mail/boites/${id}/dossiers`),

  // Journal
  getJournal: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.date) qs.set('date', params.date)
    if (params.boiteId) qs.set('boiteId', params.boiteId)
    return request('GET', `/mail/journal${qs.toString() ? `?${qs}` : ''}`)
  },
  getJournalDates: () => request('GET', '/mail/journal/dates'),

  // Brouillons
  getBrouillons: () => request('GET', '/mail/brouillons'),
  updateBrouillon: (id, brouillon) => request('PUT', `/mail/brouillons/${id}`, { brouillon }),
  supprimerBrouillon: (id) => request('DELETE', `/mail/brouillons/${id}`),
  envoyerBrouillon: (id) => request('POST', `/mail/brouillons/${id}/envoyer`),

  // OAuth2 Outlook
  getOutlookAuthUrl: () => request('GET', '/mail/oauth/outlook/url'),
  exchangeOutlookCode: (boiteId, callbackUrl) => request('POST', '/mail/oauth/outlook/exchange', { boiteId, callbackUrl }),

  // Corrections
  corrigerLog: (id, action, raison, dossierCible) => request('POST', `/mail/journal/${id}/corriger`, { action, raison, dossierCible })
}

// --- Site ME ---

export const site = {
  // Scrape une page Amazon (Puppeteer)
  scraperAmazon: (url) => request('POST', '/site/scrape', { url }),
  // Génère une accroche courte via Gemini
  genererAccroche: (description) => request('POST', '/site/generer-accroche', { description }),
  // Récupère les catégories WooCommerce
  getCategories: () => request('GET', '/site/categories'),
  // Upload une image vers la médiathèque WordPress
  // file : File object, meta : { altText, title, caption }
  uploadMedia: async (file, meta = {}) => {
    const formData = new FormData()
    formData.append('image', file)
    if (meta.altText)     formData.append('altText', meta.altText)
    if (meta.title)       formData.append('title', meta.title)
    if (meta.caption)     formData.append('caption', meta.caption)
    if (meta.description) formData.append('description', meta.description)

    const token = getToken()
    const res = await fetch(`${BASE}/site/media`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Erreur ${res.status}`)
    }
    return res.json() // { id, src }
  },
  // Prompt général articles
  getNewsPrompt: () => request('GET', '/site/news-prompt'),
  saveNewsPrompt: (prompt) => request('PUT', '/site/news-prompt', { prompt }),
  // Génère un article via Gemini Pro
  genererArticle: (generalPrompt, instruction) =>
    request('POST', '/site/article/generer', { generalPrompt, instruction }),
  // Publie un article sur WordPress
  publierArticle: (data) => request('POST', '/site/article', data),
  // Publie un produit sur WooCommerce
  publierProduit: (bookData, options) => request('POST', '/site/produit', { bookData, options }),
  // Liste les produits WooCommerce
  getProduits: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.limit) qs.set('limit', params.limit)
    if (params.status) qs.set('status', params.status)
    return request('GET', `/site/produits${qs.toString() ? `?${qs}` : ''}`)
  }
}

// --- Instagram ---

async function uploadRequest(method, path, formData) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  })
  if (!r.ok) throw new Error((await r.json()).error || r.statusText)
  return r.json()
}

export const instagram = {
  // Backgrounds
  getBackgrounds: () => request('GET', '/instagram/backgrounds'),
  createBackground: (formData) => uploadRequest('POST', '/instagram/backgrounds', formData),
  setDefaultBackground: (id) => request('PUT', `/instagram/backgrounds/${id}/defaut`, {}),
  deleteBackground: (id) => request('DELETE', `/instagram/backgrounds/${id}`),

  // Éléments
  getElements: (tag) => request('GET', `/instagram/elements${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`),
  createElement: (formData) => uploadRequest('POST', '/instagram/elements', formData),
  updateElement: (id, data) => request('PUT', `/instagram/elements/${id}`, data),
  deleteElement: (id) => request('DELETE', `/instagram/elements/${id}`),

  // Fonts
  getFonts: () => request('GET', '/instagram/fonts'),
  createFont: (formData) => uploadRequest('POST', '/instagram/fonts', formData),
  setDefaultFont: (id, role) => request('PUT', `/instagram/fonts/${id}/defaut`, { role }),
  deleteFont: (id) => request('DELETE', `/instagram/fonts/${id}`),

  // Couleurs
  getCouleurs: () => request('GET', '/instagram/couleurs'),
  createCouleur: (data) => request('POST', '/instagram/couleurs', data),
  updateCouleur: (id, data) => request('PUT', `/instagram/couleurs/${id}`, data),
  deleteCouleur: (id) => request('DELETE', `/instagram/couleurs/${id}`),

  // Posts
  getPosts: () => request('GET', '/instagram/posts'),
  getPost: (id) => request('GET', `/instagram/posts/${id}`),
  createPost: (data) => request('POST', '/instagram/posts', data),
  updatePost: (id, data) => request('PUT', `/instagram/posts/${id}`, data),
  deletePost: (id) => request('DELETE', `/instagram/posts/${id}`),
  publierPost: (id, images) => request('POST', `/instagram/posts/${id}/publier`, { images }),
  programmerPost: (id, scheduledAt, images) => request('POST', `/instagram/posts/${id}/programmer`, { scheduledAt, images }),
  deprogrammerPost: (id) => request('POST', `/instagram/posts/${id}/deprogrammer`, {}),

  // Exclusions
  getExclusions: () => request('GET', '/instagram/exclusions'),
  createExclusion: (data) => request('POST', '/instagram/exclusions', data),
  deleteExclusion: (id) => request('DELETE', `/instagram/exclusions/${id}`),

  // Brouillons
  getBrouillons: (statut) => request('GET', `/instagram/brouillons${statut ? `?statut=${statut}` : ''}`),
  updateBrouillon: (id, data) => request('PUT', `/instagram/brouillons/${id}`, data),
  envoyerBrouillon: (id) => request('POST', `/instagram/brouillons/${id}/envoyer`, {}),
  ignorerBrouillon: (id) => request('POST', `/instagram/brouillons/${id}/ignorer`, {}),

  // Config
  getConfig: () => request('GET', '/instagram/config'),
  setConfig: (cle, valeur) => request('PUT', `/instagram/config/${cle}`, { valeur }),

  // Activité
  getActivite: (limite = 10) => request('GET', `/instagram/activite?limite=${limite}`),

  // Templates
  getTemplates: () => request('GET', '/instagram/templates'),

  // Planification
  getPlanification:     ()           => request('GET', '/instagram/planification'),
  createPlanification:  (data)       => request('POST', '/instagram/planification', data),
  deletePlanification:  (id)         => request('DELETE', `/instagram/planification/${id}`),
  testerPlanification:  (id)         => request('POST', `/instagram/planification/${id}/tester`),

  // OAuth
  getOauthUrl:    () => request('GET', '/instagram/oauth/url'),
  getOauthStatus: () => request('GET', '/instagram/oauth/status'),
}

