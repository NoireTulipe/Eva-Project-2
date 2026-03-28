import { useState } from 'react'

export default function Admin() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  async function verifierBackend() {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      setStatus({ ok: true, message: `En ligne — ${data.timestamp ?? new Date().toISOString()}` })
    } catch {
      setStatus({ ok: false, message: 'Backend inaccessible' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Administration</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <p className="text-gray-500 text-sm mb-6">
          Ce module est en cours de développement. Les routes <code>/admin</code> ne sont pas encore implémentées côté backend.
        </p>
        <button
          onClick={verifierBackend}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm"
        >
          {loading ? 'Vérification...' : 'Vérifier la connexion backend'}
        </button>
        {status && (
          <p className={`mt-4 text-sm ${status.ok ? 'text-green-700' : 'text-red-600'}`}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  )
}
