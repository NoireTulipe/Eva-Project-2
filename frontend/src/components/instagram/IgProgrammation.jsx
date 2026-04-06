import { useState } from 'react'

export default function IgProgrammation({ onClose, onProgrammer }) {
  // Date/heure par défaut : demain à 10h
  const demain = new Date()
  demain.setDate(demain.getDate() + 1)
  demain.setHours(10, 0, 0, 0)
  const defaut = demain.toISOString().slice(0, 16) // format input datetime-local

  const [scheduledAt, setScheduledAt] = useState(defaut)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  async function confirmer() {
    if (!scheduledAt) return
    const date = new Date(scheduledAt)
    if (date <= new Date()) { setError('La date doit être dans le futur'); return }
    setLoading(true)
    setError(null)
    try {
      await onProgrammer(date.toISOString())
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold">Programmer la publication</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date et heure de publication</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Comment ça fonctionne</p>
            <ul className="text-xs space-y-1 text-blue-700">
              <li>• Le post sera publié automatiquement à l'heure choisie</li>
              <li>• EVA vérifie les publications programmées toutes les minutes</li>
              <li>• Vous pouvez déprogrammer depuis la liste des posts</li>
            </ul>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
              Annuler
            </button>
            <button
              onClick={confirmer}
              disabled={loading || !scheduledAt}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Programmation…' : '🕐 Programmer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
