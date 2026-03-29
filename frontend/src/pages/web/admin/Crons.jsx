import { useState, useEffect } from 'react'
import { admin } from '../../../shared/api.js'

export default function Crons() {
  const [crons, setCrons] = useState([])
  const [running, setRunning] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editExpr, setEditExpr] = useState('')
  const [error, setError] = useState('')

  async function charger() {
    try {
      const data = await admin.getCrons()
      setCrons(data)
    } catch {
      setError('Erreur chargement')
    }
  }

  useEffect(() => { charger() }, [])

  async function toggleActif(c) {
    const updated = await admin.updateCron(c.id, { actif: !c.actif })
    setCrons(prev => prev.map(x => x.id === updated.id ? { ...updated, enCours: updated.actif } : x))
  }

  async function saveExpr(c) {
    const updated = await admin.updateCron(c.id, { expression: editExpr })
    setCrons(prev => prev.map(x => x.id === updated.id ? updated : x))
    setEditId(null)
  }

  async function runNow(c) {
    setRunning(c.id)
    try {
      const res = await admin.runCron(c.id)
      alert(res.message)
      await charger()
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(null)
    }
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tâches cron</h1>

      <div className="space-y-3">
        {crons.map(c => (
          <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 font-mono text-sm">{c.nom}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.enCours ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {c.enCours ? 'actif' : 'inactif'}
                  </span>
                </div>
                {c.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {editId === c.id ? (
                    <>
                      <input
                        className="border border-gray-300 rounded px-2 py-1 text-sm font-mono w-40 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={editExpr}
                        onChange={e => setEditExpr(e.target.value)}
                      />
                      <button onClick={() => saveExpr(c)} className="text-xs text-indigo-600 hover:underline">OK</button>
                      <button onClick={() => setEditId(null)} className="text-xs text-gray-500 hover:underline">Annuler</button>
                    </>
                  ) : (
                    <>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{c.expression}</code>
                      <button
                        onClick={() => { setEditId(c.id); setEditExpr(c.expression) }}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Modifier
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => runNow(c)}
                  disabled={running === c.id}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {running === c.id ? '…' : '▶ Lancer'}
                </button>
                <button
                  onClick={() => toggleActif(c)}
                  className={`px-3 py-1.5 text-xs rounded-lg ${
                    c.actif
                      ? 'border border-red-300 text-red-600 hover:bg-red-50'
                      : 'border border-green-300 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {c.actif ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {crons.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-400">
            Aucune tâche cron configurée
          </div>
        )}
      </div>
    </div>
  )
}
