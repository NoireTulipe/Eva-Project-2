/**
 * IgGenerateurIA — Génération de texte par Mistral
 *
 * Mode multi-slide : une instruction par champ nommé, par vignette.
 * Mistral remplit chaque champ dans chaque vignette.
 */
import { useState } from 'react'

export default function IgGenerateurIA({ slides, slideIdx, onClose, onApply }) {

  // Collecter tous les champs texte nommés de toutes les vignettes
  const slidesAvecChamps = slides.map((s, si) => ({
    si,
    textEls: (s.elements ?? []).filter(e => e.type === 'text' && e.iaEnabled !== false),
  })).filter(s => s.textEls.length > 0)

  const [sujet, setSujet]           = useState('')
  const [mode, setMode]             = useState('courant') // 'courant' | 'tous'
  const [instructions, setInst]     = useState({})        // { `${si}-${id}`: string }
  const [legendeInst, setLegInst]   = useState('Légende Instagram avec emojis, call-to-action et hashtags pertinents')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [result, setResult]         = useState(null)

  const targetSlides = mode === 'courant'
    ? slidesAvecChamps.filter(s => s.si === slideIdx)
    : slidesAvecChamps

  function setInstruction(si, id, val) {
    setInst(prev => ({ ...prev, [`${si}-${id}`]: val }))
  }
  function getInstruction(si, id) {
    return instructions[`${si}-${id}`] ?? ''
  }

  async function generer() {
    if (!sujet.trim()) return
    setLoading(true)
    setError(null)
    try {
      // Appel séquentiel par slide (pour ne pas mélanger les contextes)
      const champsParSlide = []
      let legendeResult = ''

      for (let i = 0; i < targetSlides.length; i++) {
        const { si, textEls } = targetSlides[i]
        const champs = textEls.map(el => ({
          nom: el.nom ?? el.id,
          instruction: getInstruction(si, el.id),
        }))
        const inclurelegende = i === 0 // légende une seule fois sur le 1er appel

        const res = await fetch('/api/instagram/generer-texte', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            sujet,
            champs,
            legendeInstruction: inclurelegende ? legendeInst : 'ne pas générer de légende, retourne legende: ""',
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
        const data = await res.json()

        // Fallback si Mistral retourne textes[]
        let champsObj = data.champs ?? {}
        if (champsObj.textes && Array.isArray(champsObj.textes)) {
          const mapped = {}
          textEls.forEach((el, idx) => { mapped[el.nom ?? el.id] = champsObj.textes[idx] ?? '' })
          champsObj = mapped
        }

        champsParSlide.push({ slideIdx: si, champs: champsObj })
        if (inclurelegende) legendeResult = data.legende ?? ''
      }

      setResult({ champsParSlide, legende: legendeResult })
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
                  placeholder="Ex : Les bienfaits de lire un livre le soir…"
                  className="w-full border rounded px-3 py-2 text-sm resize-y" rows={3} />
              </div>

              {/* Mode : vignette courante ou toutes */}
              {slides.length > 1 && (
                <div className="flex gap-2">
                  {[
                    { val: 'courant', label: `Vignette ${slideIdx + 1} seulement` },
                    { val: 'tous',    label: `Toutes les vignettes (${slides.length})` },
                  ].map(m => (
                    <button key={m.val} onClick={() => setMode(m.val)}
                      className={`flex-1 py-1.5 text-xs border rounded transition-colors ${
                        mode === m.val ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-gray-50'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Champs par vignette */}
              {targetSlides.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
                  Aucun champ texte sur cette vignette. Ajoutez des textes et nommez-les dans les propriétés.
                </div>
              ) : (
                <div className="space-y-3">
                  {targetSlides.map(({ si, textEls }) => (
                    <div key={si}>
                      {mode === 'tous' && (
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">
                          Vignette {si + 1}
                        </p>
                      )}
                      <div className="space-y-2">
                        {textEls.map(el => (
                          <div key={el.id} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs font-medium rounded">
                                {el.nom ?? el.id}
                              </span>
                              <span className="text-xs text-gray-400 truncate italic">
                                « {(el.text ?? '').slice(0, 35)}{(el.text ?? '').length > 35 ? '…' : ''} »
                              </span>
                            </div>
                            <input type="text"
                              value={getInstruction(si, el.id)}
                              onChange={e => setInstruction(si, el.id, e.target.value)}
                              placeholder="Ex : Titre accrocheur en 5 mots"
                              className="w-full border rounded px-2 py-1 text-sm bg-white" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
              {/* Résultats */}
              {result.champsParSlide.map(({ slideIdx: si, champs }) => (
                <div key={si}>
                  {result.champsParSlide.length > 1 && (
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">Vignette {si + 1}</p>
                  )}
                  <div className="space-y-2">
                    {Object.entries(champs).map(([nom, texte]) => (
                      <div key={nom} className="border rounded-lg p-3">
                        <p className="text-xs font-medium text-pink-600 mb-1">{nom}</p>
                        <textarea
                          value={texte}
                          onChange={e => setResult(prev => ({
                            ...prev,
                            champsParSlide: prev.champsParSlide.map(entry =>
                              entry.slideIdx === si
                                ? { ...entry, champs: { ...entry.champs, [nom]: e.target.value } }
                                : entry
                            )
                          }))}
                          className="w-full border rounded px-2 py-1.5 text-sm resize-y"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

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
              <button onClick={generer}
                disabled={loading || !sujet.trim() || targetSlides.length === 0}
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
