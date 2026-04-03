import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CapacitorHttp } from '@capacitor/core'
import { auth, getApiUrl, setApiUrl, getApiBase } from '../shared/api.js'

const debugLogs = []
function addLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`
  debugLogs.unshift(line)
  if (debugLogs.length > 100) debugLogs.pop()
  console.log('[EVA-DEBUG]', msg)
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [debugText, setDebugText] = useState('')
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl())

  async function fetchTest(label, url, opts = {}) {
    addLog(`[${label}] GET ${url}`)
    try {
      const t0 = Date.now()
      const res = await fetch(url, { method: 'GET', ...opts })
      addLog(`[${label}] OK ${res.status} (${Date.now()-t0}ms)`)
      // log CORS headers
      const acao = res.headers.get('access-control-allow-origin')
      addLog(`[${label}] ACAO: ${acao || '(absent)'}`)
      const txt = await res.text()
      addLog(`[${label}] Body: ${txt.substring(0, 80)}`)
    } catch (err) {
      addLog(`[${label}] FAIL name=${err.name}`)
      addLog(`[${label}] msg=${err.message}`)
    }
  }

  async function xhrTest(url) {
    addLog(`[XHR] GET ${url}`)
    return new Promise(resolve => {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url)
      xhr.timeout = 10000
      xhr.onload = () => {
        addLog(`[XHR] OK status=${xhr.status}`)
        addLog(`[XHR] ACAO: ${xhr.getResponseHeader('access-control-allow-origin') || '(absent)'}`)
        addLog(`[XHR] Body: ${xhr.responseText.substring(0, 80)}`)
        resolve()
      }
      xhr.onerror = () => { addLog(`[XHR] onerror (réseau ou CORS)`); resolve() }
      xhr.ontimeout = () => { addLog(`[XHR] timeout`); resolve() }
      xhr.send()
    })
  }

  async function testConnexion() {
    const base = getApiBase()
    addLog(`=== DIAGNOSTIC RÉSEAU ===`)
    addLog(`onLine: ${navigator.onLine} | proto: ${window.location.protocol} | host: ${window.location.hostname}`)
    addLog(`Cible: ${base}`)

    // Test 1 : fetch mode cors (standard)
    await fetchTest('CORS', `${base}/health`, { mode: 'cors' })

    // Test 2 : fetch mode no-cors (bypass CORS check côté browser)
    await fetchTest('NO-CORS', `${base}/health`, { mode: 'no-cors' })

    // Test 3 : XHR (code path différent)
    await xhrTest(`${base}/health`)

    // Test 4 : fetch vers Google (réseau général)
    await fetchTest('GOOGLE', 'https://www.google.com', { mode: 'no-cors' })

    // Test 5 : CapacitorHttp natif direct (bypass WebView entièrement)
    addLog(`[CAP-HTTP] GET ${base}/health`)
    try {
      const r = await CapacitorHttp.request({ method: 'GET', url: `${base}/health`, headers: {} })
      addLog(`[CAP-HTTP] OK status=${r.status}`)
      addLog(`[CAP-HTTP] Data: ${JSON.stringify(r.data).substring(0, 80)}`)
    } catch (err) {
      addLog(`[CAP-HTTP] FAIL name=${err.name} msg=${err.message}`)
    }

    addLog(`=== FIN DIAGNOSTIC ===`)
    setShowDebug(true)
    setDebugText(debugLogs.join('\n'))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    const base = getApiBase()
    const url = base + '/auth/login'
    addLog(`=== LOGIN ATTEMPT ===`)
    addLog(`navigator.onLine: ${navigator.onLine}`)
    addLog(`URL: ${url}`)
    addLog(`localStorage api_url: ${localStorage.getItem('api_url') || '(non défini → défaut)'}`)
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort(); addLog('TIMEOUT 15s') }, 15000)
    try {
      const t0 = Date.now()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
        cache: 'no-store'
      })
      clearTimeout(timer)
      const ms = Date.now() - t0
      addLog(`Status: ${res.status} ${res.statusText} (${ms}ms)`)
      addLog(`Headers Content-Type: ${res.headers.get('content-type')}`)
      const text = await res.text()
      addLog(`Body (200c): ${text.substring(0, 200)}`)
      if (!res.ok) throw new Error(JSON.parse(text).error || `Erreur ${res.status}`)
      const data = JSON.parse(text)
      if (data.token) {
        localStorage.setItem('token', data.token)
        if (data.refreshToken) localStorage.setItem('refresh', data.refreshToken)
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
        addLog('Login OK → /caisse')
        navigate('/caisse', { replace: true })
      } else {
        throw new Error('Pas de token dans la réponse')
      }
    } catch (err) {
      clearTimeout(timer)
      addLog(`ERREUR name: ${err.name}`)
      addLog(`ERREUR message: ${err.message}`)
      addLog(`ERREUR stack: ${(err.stack || '(pas de stack)').substring(0, 300)}`)
      if (err.name === 'AbortError') addLog('→ TIMEOUT: serveur injoignable ou trop lent')
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        addLog('→ TypeError fetch = SSL invalide ? DNS échoue ? Réseau coupé ? CORS preflight ?')
      }
      setError(err.message || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  function openDebug() {
    setDebugText(debugLogs.join('\n') || "(aucun log — clique 'Se connecter' ou l'éclair d'abord)")
    setShowDebug(true)
  }

  function sauvegarderApi() {
    setApiUrl(apiUrlInput.trim())
    setShowSettings(false)
    setError('')
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 bg-gray-50">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-white text-3xl font-bold">E</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">EVA</h1>
          <p className="text-gray-500 mt-1">Maison d'Édition</p>
        </div>

        {/* Formulaire login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              autoComplete="email"
              inputMode="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!email || !password || loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-base font-semibold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform mt-2"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {/* Panneau réglages serveur */}
        {showSettings ? (
          <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adresse du serveur</p>
            <input
              type="url"
              value={apiUrlInput}
              onChange={e => setApiUrlInput(e.target.value)}
              placeholder="https://eva.echodeplumes.com"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <p className="text-xs text-gray-400">Ex : http://192.168.1.42:3000</p>
            <div className="flex gap-2">
              <button
                onClick={sauvegarderApi}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium"
              >
                Enregistrer
              </button>
              <button
                onClick={() => { setShowSettings(false); setApiUrlInput(getApiUrl()) }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <>
          {/* Boutons discrets */}
          <div className="flex justify-center gap-4 mt-8">
            <button onClick={() => setShowSettings(true)} className="p-2 text-gray-300 hover:text-gray-400" title="Paramètres serveur">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button onClick={testConnexion} className="p-2 text-gray-300 hover:text-gray-400" title="Tester la connexion">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
            <button onClick={openDebug} className="p-2 text-gray-300 hover:text-gray-400" title="Debug">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* Panel debug */}
          {showDebug && (
            <div className="fixed inset-0 bg-black/80 z-50 flex flex-col p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-white text-sm font-bold">Debug logs</p>
                <button onClick={() => setShowDebug(false)} className="text-white text-lg">✕</button>
              </div>
              <p className="text-gray-400 text-xs mb-2">URL : {getApiBase()}</p>
              <textarea
                readOnly
                value={debugText}
                className="flex-1 bg-gray-900 text-green-400 text-xs font-mono rounded-xl p-3 resize-none"
              />
            </div>
          )}
          </>
        )}
      </div>
    </div>
  )
}
