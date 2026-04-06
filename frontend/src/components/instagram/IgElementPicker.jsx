import { useState, useEffect, useRef } from 'react'
import { instagram } from '../../shared/api.js'

export default function IgElementPicker({ onAdd, onClose }) {
  const [elements, setElements] = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const ref = useRef(null)

  async function load(tag) {
    setLoading(true)
    setElements(await instagram.getElements(tag || undefined).catch(() => []))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-72"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Éléments graphiques</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      {/* Recherche */}
      <div className="p-2 border-b flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(search)}
          placeholder="Mot-clé…"
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
        <button
          onClick={() => load(search)}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
        >
          🔍
        </button>
        {search && (
          <button
            onClick={() => { setSearch(''); load() }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Grille d'éléments */}
      <div className="p-2 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">Chargement…</p>
        ) : elements.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Aucun élément — importez-en dans Bibliothèques
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {elements.map(el => (
              <button
                key={el.id}
                onClick={() => {
                  onAdd(`/uploads/instagram/elements/${el.fichier}`, el.nom)
                  onClose()
                }}
                className="aspect-square border rounded overflow-hidden hover:border-pink-400 hover:shadow transition-all bg-gray-50 p-1 group"
                title={el.nom}
              >
                <img
                  src={`/uploads/instagram/elements/${el.fichier}`}
                  alt={el.nom}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {elements.length > 0 && (
        <p className="text-xs text-gray-400 px-3 py-1.5 border-t">
          Cliquez pour ajouter au canvas
        </p>
      )}
    </div>
  )
}
