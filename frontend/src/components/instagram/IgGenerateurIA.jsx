import { useState } from 'react'

export default function IgGenerateurIA({ nbSlides, onClose, onApply }) {
  const [sujet, setSujet]           = useState('')
  const [nbPhrases, setNbPhrases]   = useState(3)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [result, setResult]         = useState(null)

  async function generer() {
    if (!sujet.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/instagram/generer-texte', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ sujet, nbPhrases, nbSlides }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold">Générer le texte avec Mistral</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sujet du post</label>
              <textarea
                value={sujet}
                onChange={e => setSujet(e.target.value)}
                placeholder="Ex : Sortie de notre nouveau roman 'L'Écho des plumes'…"
                className="w-full border rounded px-3 py-2 text-sm resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  Phrases max (texte image)
                </label>
                <input
                  type="number" min={1} max={10}
                  value={nbPhrases}
                  onChange={e => setNbPhrases(parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  Vignettes
                </label>
                <input
                  type="text"
                  value={nbSlides}
                  readOnly
                  className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50 text-gray-500"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={generer}
                disabled={loading || !sujet.trim()}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Génération…' : '✦ Générer'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Textes par vignette</label>
              {result.textes.map((t, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs text-gray-500 mb-0.5">Vignette {i + 1}</p>
                  <textarea
                    value={t}
                    onChange={e => {
                      const updated = [...result.textes]
                      updated[i] = e.target.value
                      setResult({ ...result, textes: updated })
                    }}
                    className="w-full border rounded px-3 py-2 text-sm resize-y"
                    rows={3}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Légende d'accompagnement</label>
              <textarea
                value={result.legende}
                onChange={e => setResult({ ...result, legende: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm resize-y"
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setResult(null)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                Régénérer
              </button>
              <button
                onClick={() => onApply(result)}
                className="px-4 py-2 text-sm bg-pink-500 text-white rounded hover:bg-pink-600"
              >
                Appliquer au canvas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
