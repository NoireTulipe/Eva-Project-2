// URL de base : priorité localStorage (réglage manuel) → défaut production
const DEFAULT_API = 'https://eva.echodeplumes.com'

export function getApiBase() {
  return (localStorage.getItem('api_url') || DEFAULT_API) + '/api'
}

export function setApiUrl(url) {
  const clean = url.replace(/\/+$/, '') // retirer slash final
  localStorage.setItem('api_url', clean)
}

export function getApiUrl() {
  return localStorage.getItem('api_url') || DEFAULT_API
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

function getToken()        { return localStorage.getItem('token') }
function getRefreshToken() { return localStorage.getItem('refresh') }
function getUser()         { try { return JSON.parse(localStorage.getItem('user')) } catch { return null } }
function isLoggedIn()      { return !!getToken() }

function saveTokens({ token, refresh, user }) {
  if (token)   localStorage.setItem('token', token)
  if (refresh) localStorage.setItem('refresh', refresh)
  if (user)    localStorage.setItem('user', JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh')
  localStorage.removeItem('user')
  localStorage.removeItem('session')
}

function logout() {
  clearSession()
  window.location.hash = '/login'
}

// ─── Client HTTP ──────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const BASE = getApiBase()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  if (res.status === 401) {
    const refreshToken = getRefreshToken()
    if (!refreshToken) { if (getToken()) logout(); throw new Error('Non authentifié') }

    const refreshRes = await fetch(`${getApiBase()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })
    if (!refreshRes.ok) { logout(); throw new Error('Session expirée') }
    const data = await refreshRes.json()
    saveTokens({ token: data.token })

    const retryRes = await fetch(`${getApiBase()}${path}`, {
      method,
      headers: { ...headers, 'Authorization': `Bearer ${data.token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    if (!retryRes.ok) {
      const err = await retryRes.json().catch(() => ({}))
      throw new Error(err.error || `Erreur ${retryRes.status}`)
    }
    if (retryRes.status === 204) return null
    return retryRes.json()
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Erreur ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  getToken, getUser, isLoggedIn, logout,
  async login(email, password) {
    const data = await request('POST', '/auth/login', { email, password })
    saveTokens({ token: data.token, refresh: data.refreshToken, user: data.user })
    return data
  }
}

// ─── Produits ─────────────────────────────────────────────────────────────────

export const produits = {
  getAll:  ()         => request('GET', '/ventes/produits'),
  create:  (data)     => request('POST', '/ventes/produits', data),
  update:  (id, data) => request('PUT', `/ventes/produits/${id}`, data),
}

// ─── Points de vente ─────────────────────────────────────────────────────────

export const pdv = {
  getAll:  ()       => request('GET', '/ventes/pdv'),
  create:  (data)   => request('POST', '/ventes/pdv', data),
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = {
  getAll:   ({ limit = 20, offset = 0 } = {}) => request('GET', `/ventes/sessions?limit=${limit}&offset=${offset}`),
  open:     (pointDeVenteId)                  => request('POST', '/ventes/sessions', { pointDeVenteId, debut: new Date().toISOString() }),
  getById:  (id)                              => request('GET', `/ventes/sessions/${id}`),
  cloturer: (id)                              => request('POST', `/ventes/sessions/${id}/cloturer`),
}

// ─── Ventes ───────────────────────────────────────────────────────────────────

export const ventes = {
  // lignes : [{ produitId, quantite, prixUnitaire }]
  enregistrer: (sessionId, methodePaiementId, lignes) =>
    request('POST', '/ventes/ventes', { sessionId, methodePaiementId, lignes }),
  annuler: (id) => request('POST', `/ventes/ventes/${id}/annuler`),
}

// ─── Frais de session ─────────────────────────────────────────────────────────

export const frais = {
  ajouterSession: (sessionId, data) => request('POST', `/ventes/sessions/${sessionId}/frais`, data),
}

// ─── Référentiels ─────────────────────────────────────────────────────────────

export const ref = {
  getAll:  (table)      => request('GET', `/ref/${table}`),
  create:  (table, nom) => request('POST', `/ref/${table}`, { nom }),
}
