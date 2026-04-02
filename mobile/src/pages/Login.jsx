import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, getApiUrl, setApiUrl } from '../shared/api.js'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl())

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    try {
      await auth.login(email, password)
      navigate('/caisse', { replace: true })
    } catch (err) {
      setError(err.message || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
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
          /* Bouton engrenage discret */
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-300 hover:text-gray-400 transition-colors"
              title="Paramètres serveur"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
