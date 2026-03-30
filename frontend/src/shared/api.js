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

// --- Produits ---

export const produits = {
  getAll: () => request('GET', '/ventes/produits'),
  getById: (id) => request('GET', `/ventes/produits/${id}`),
  getStock: (id) => request('GET', `/ventes/produits/${id}/stock`),
  create: (data) => request('POST', '/ventes/produits', data),
  update: (id, data) => request('PUT', `/ventes/produits/${id}`, data),
  remove: (id) => request('DELETE', `/ventes/produits/${id}`)
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
  cloturer: (id) => request('POST', `/ventes/sessions/${id}/cloturer`)
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

  // Système
  getSystemeStatus: () => request('GET', '/admin/systeme/status'),
  restart: () => request('POST', '/admin/systeme/restart')
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
  }
}
