/**
 * IgGenerateurIA — Génération de texte par Mistral
 *
 * Nouveau mode : champs nommés
 * - Chaque élément texte de la vignette a un nom ("Titre", "Accroche"…)
 * - L'utilisateur écrit une instruction par champ
 * - Mistral remplit chaque champ au bon endroit
 * - Permet de créer des masques réutilisables (gabarits)
 */
import { useState } from 'react'

export default function IgGenerateurIA({ slides, slideIdx, onClose, onApply }) {
  const slide    = slides[slideIdx] ?? slides[0]
  const textEls  = (slide?.elements ?? []).filter(e => e.type === 'text')

  const [sujet, setSujet]       = useState('')
  const [instructions, setInst] = useState(() =>
    Object.fromEntries(textEls.map(el => [el.id, '']))
  )
  const [legendeInst, setLegInst] = useState('Légende Instagram avec emojis, call-to-action et hashtags pertinents')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [result, setResult]     = useState(null)

  function setInstruction(id, val) {
    setInst(prev => ({ ...prev, [id]: val }))
  }

  async function generer() {
    if (!sujet.trim()) return
    setLoading(true)
    setError(null)
    try {
      const champs = textEls.map(el => ({
        nom:         el.nom ?? el.id,
        instruction: instructions[el.id] ?? '',
      }))
      const res = await fetch('/api/instagram/generer-texte', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ sujet, champs, legendeInstruction: legendeInst }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
      const data = await res.json()
      // Fallback : si Mistral retourne encore { textes: [...] }, on mappe dans l'ordre des champs
      if (data.champs?.textes && Array.isArray(data.champs.textes)) {
        const mapped = {}
        textEls.forEach((el, i) => {
          mapped[el.nom ?? el.id] = data.champs.textes[i] ?? ''
        })
        data.champs = mapped
      }
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3 border-b flex-shrink-0">
          <h2 className="text-base font-semibold">✦ Générer avec Mistral</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!result ? (
            <>
              {/* Sujet */}
              <div>
                <label className="block text-sm font-medium mb-1">Sujet du post</label>
                <textarea value={sujet} onChange={e => setSujet(e.target.value)}
                  placeholder="Ex : Les bienfaits de lire un livre le soir plutôt que naviguer sur les réseaux…"
                  className="w-full border rounded px-3 py-2 text-sm resize-y" rows={3} />
              </div>

              {/* Champs nommés */}
              {textEls.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
                  Aucun champ texte sur cette vignette. Ajoutez des textes et nommez-les dans le panneau de propriétés.
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Instructions par champ
                    <span className="ml-1 text-xs text-gray-400 font-normal">(nommez vos textes dans les propriétés)</span>
                  </label>
                  <div className="space-y-2">
                    {textEls.map(el => (
                      <div key={el.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs font-medium rounded">
                            {el.nom ?? el.id}
                          </span>
                          <span className="text-xs text-gray-400 truncate italic">
                            « {(el.text ?? '').slice(0, 40)}{(el.text ?? '').length > 40 ? '…' : ''} »
                          </span>
                        </div>
                        <input
                          type="text"
                          value={instructions[el.id] ?? ''}
                          onChange={e => setInstruction(el.id, e.target.value)}
                          placeholder={`Ex : Titre accrocheur en 5 mots`}
                          className="w-full border rounded px-2 py-1 text-sm bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Légende */}
              <div>
                <label className="block text-sm font-medium mb-1">Instruction légende</label>
                <input type="text" value={legendeInst} onChange={e => setLegInst(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          ) : (
            <>
              {/* Résultats par champ */}
              <div>
                <label className="block text-sm font-medium mb-2">Résultats</label>
                <div className="space-y-2">
                  {textEls.map(el => {
                    const nom = el.nom ?? el.id
                    return (
                      <div key={el.id} className="border rounded-lg p-3">
                        <p className="text-xs font-medium text-pink-600 mb-1">{nom}</p>
                        <textarea
                          value={result.champs?.[nom] ?? ''}
                          onChange={e => setResult(prev => ({
                            ...prev,
                            champs: { ...prev.champs, [nom]: e.target.value }
                          }))}
                          className="w-full border rounded px-2 py-1.5 text-sm resize-y"
                          rows={3}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Légende */}
              <div>
                <label className="block text-sm font-medium mb-1">Légende</label>
                <textarea value={result.legende ?? ''} rows={5}
                  onChange={e => setResult(prev => ({ ...prev, legende: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm resize-y" />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex justify-end gap-2 flex-shrink-0 border-t pt-3">
          {!result ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={generer} disabled={loading || !sujet.trim() || textEls.length === 0}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                {loading ? 'Génération…' : '✦ Générer'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setResult(null)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                Régénérer
              </button>
              <button onClick={() => onApply(result)}
                className="px-4 py-2 text-sm bg-pink-500 text-white rounded hover:bg-pink-600">
                Appliquer au canvas
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
