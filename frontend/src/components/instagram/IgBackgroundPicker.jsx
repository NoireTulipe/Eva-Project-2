import { useEffect, useRef, useState } from 'react'
import { instagram } from '../../shared/api.js'

export default function IgBackgroundPicker({ current, onSelect, onClose }) {
  const [tab, setTab]   = useState('couleur') // 'couleur' | 'bibliotheque'
  const [bgs, setBgs]   = useState([])
  const [couleur, setCouleur] = useState(current?.type === 'color' ? current.value : '#ffffff')
  const ref = useRef(null)

  useEffect(() => {
    instagram.getBackgrounds().then(setBgs).catch(() => {})
  }, [])

  // Fermer en cliquant dehors
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg w-64"
    >
      <div className="flex border-b">
        {['couleur', 'bibliotheque'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium ${tab === t ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
          >
            {t === 'couleur' ? 'Couleur unie' : 'Bibliothèque'}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === 'couleur' && (
          <div className="space-y-2">
            <input
              type="color"
              value={couleur}
              onChange={e => setCouleur(e.target.value)}
              className="w-full h-10 cursor-pointer rounded border"
            />
            <button
              onClick={() => onSelect({ type: 'color', value: couleur })}
              className="w-full py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600"
            >
              Appliquer
            </button>
          </div>
        )}

        {tab === 'bibliotheque' && (
          <div>
            {bgs.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun fond — ajoutez-en dans Bibliothèques
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {bgs.map(bg => (
                  <button
                    key={bg.id}
                    onClick={() => onSelect({ type: 'image', value: `/uploads/instagram/backgrounds/${bg.fichier}` })}
                    className={`aspect-square rounded border-2 overflow-hidden ${
                      current?.value?.includes(bg.fichier) ? 'border-pink-500' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <img
                      src={`/uploads/instagram/backgrounds/${bg.fichier}`}
                      alt={bg.nom}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
