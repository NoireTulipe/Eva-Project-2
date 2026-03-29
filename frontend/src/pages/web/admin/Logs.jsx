import { useState, useEffect } from 'react'
import { admin } from '../../../shared/api.js'

export default function AdminLogs() {
  const [fichier, setFichier] = useState('actions')
  const [lignes, setLignes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function charger() {
    setLoading(true)
    setError('')
    try {
      const data = await admin.getLogs(fichier, 300)
      setLignes(data.lignes || [])
    } catch {
      setError('Erreur chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [fichier])

  async function vider() {
    if (!confirm(`Vider ${fichier}.log ?`)) return
    await admin.clearLogs(fichier)
    setLignes([])
  }

  function colorLine(line) {
    if (line.includes('ERROR')) return 'text-red-700 bg-red-50'
    if (line.includes('ACTION')) return 'text-gray-800'
    return 'text-gray-500'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Journaux</h1>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          {['actions', 'errors'].map(f => (
            <button
              key={f}
              onClick={() => setFichier(f)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                fichier === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}.log
            </button>
          ))}
        </div>
        <button
          onClick={charger}
          disabled={loading}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '…' : '↻ Rafraîchir'}
        </button>
        <button
          onClick={vider}
          className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 ml-auto"
        >
          Vider
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto font-mono text-xs" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        {lignes.length === 0
          ? <span className="text-gray-400">Aucune entrée</span>
          : lignes.map((l, i) => (
              <div key={i} className={`leading-6 px-1 rounded ${colorLine(l)}`}>{l}</div>
            ))
        }
      </div>
    </div>
  )
}
