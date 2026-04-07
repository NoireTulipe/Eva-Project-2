/**
 * IgLibraryPanel — Panneau bibliothèque intégré à l'éditeur
 * Fonds | Éléments | Polices
 */
import { useState, useEffect } from 'react'
import { instagram } from '../../shared/api.js'
import { loadGoogleFont } from './useGoogleFonts.js'

export default function IgLibraryPanel({ onAddImage, onSetBackground }) {
  const [tab, setTab]           = useState('fonds')
  const [backgrounds, setBgs]   = useState([])
  const [elements, setEls]      = useState([])
  const [fonts, setFonts]       = useState([])
  const [search, setSearch]     = useState('')
  const [couleur, setCouleur]   = useState('#ffffff')
  const [uploading, setUploading] = useState(false)

  useEffect(() => { reload(tab) }, [tab])

  function reload(t) {
    if (t === 'fonds')    instagram.getBackgrounds().then(setBgs).catch(() => {})
    if (t === 'elements') instagram.getElements().then(setEls).catch(() => {})
    if (t === 'polices')  instagram.getFonts().then(fs => {
      setFonts(fs)
      fs.forEach(f => f.googleFont && loadGoogleFont(f.googleFont))
    }).catch(() => {})
  }

  async function uploadBg(file) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('fichier', file)
      fd.append('nom', file.name.replace(/\.[^.]+$/, ''))
      await instagram.createBackground(fd)
      instagram.getBackgrounds().then(setBgs)
    } finally { setUploading(false) }
  }

  async function uploadEl(file) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('fichier', file)
      fd.append('nom', file.name.replace(/\.[^.]+$/, ''))
      await instagram.createElement(fd)
      instagram.getElements().then(setEls)
    } finally { setUploading(false) }
  }

  const filtered = search ? elements.filter(e => e.nom.toLowerCase().includes(search.toLowerCase())) : elements

  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Onglets */}
      <div className="flex border-b flex-shrink-0">
        {[
          { id: 'fonds',    icon: '🎨', label: 'Fonds'   },
          { id: 'elements', icon: '⭐', label: 'Élém.'   },
          { id: 'polices',  icon: 'A',  label: 'Polices' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            <span className="block text-sm leading-none mb-0.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">

        {/* ── Fonds ─────────────────────────────────────────────────────── */}
        {tab === 'fonds' && <>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Couleur unie</p>
            <input type="color" value={couleur} onChange={e => setCouleur(e.target.value)}
              className="w-full h-8 cursor-pointer rounded border" />
            <button onClick={() => onSetBackground({ type: 'color', value: couleur })}
              className="w-full py-1 text-xs bg-pink-500 text-white rounded hover:bg-pink-600">
              Appliquer
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-500">Bibliothèque</p>
              <label className="cursor-pointer text-xs text-pink-500 hover:text-pink-700">
                + Ajouter
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files[0] && uploadBg(e.target.files[0])} />
              </label>
            </div>
            {backgrounds.length === 0
              ? <p className="text-xs text-gray-400 text-center py-3">Aucun fond</p>
              : <div className="grid grid-cols-2 gap-1.5">
                  {backgrounds.map(bg => (
                    <button key={bg.id}
                      onClick={() => onSetBackground({ type: 'image', value: `/uploads/instagram/backgrounds/${bg.fichier}` })}
                      className="aspect-square rounded border border-gray-200 overflow-hidden hover:border-pink-400 transition-colors">
                      <img src={`/uploads/instagram/backgrounds/${bg.fichier}`} alt={bg.nom}
                        className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
            }
          </div>
        </>}

        {/* ── Éléments ──────────────────────────────────────────────────── */}
        {tab === 'elements' && <>
          <div className="flex gap-1">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…" className="flex-1 border rounded px-2 py-0.5 text-xs" />
            {search && <button onClick={() => setSearch('')} className="text-gray-400 text-xs px-1">×</button>}
          </div>
          <label className="block w-full text-center cursor-pointer text-xs text-pink-500 hover:text-pink-700
            border border-dashed border-pink-200 rounded py-1.5 hover:bg-pink-50 transition-colors">
            + Ajouter un élément
            <input type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files[0] && uploadEl(e.target.files[0])} />
          </label>
          {filtered.length === 0
            ? <p className="text-xs text-gray-400 text-center py-2">Aucun élément</p>
            : <div className="grid grid-cols-3 gap-1">
                {filtered.map(el => (
                  <button key={el.id} title={el.nom}
                    onClick={() => onAddImage(`/uploads/instagram/elements/${el.fichier}`, el.nom)}
                    className="aspect-square border rounded overflow-hidden hover:border-pink-400 bg-gray-50 p-0.5 transition-colors">
                    <img src={`/uploads/instagram/elements/${el.fichier}`} alt={el.nom}
                      className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
          }
        </>}

        {/* ── Polices ───────────────────────────────────────────────────── */}
        {tab === 'polices' && <>
          {fonts.length === 0
            ? <p className="text-xs text-gray-400 text-center py-3">Aucune police en bibliothèque</p>
            : fonts.map(f => (
                <div key={f.id} className="px-2 py-1.5 rounded border border-transparent hover:border-gray-200 hover:bg-gray-50">
                  <p className="text-xs text-gray-400 leading-none mb-0.5">{f.nom}</p>
                  <p className="text-sm leading-snug truncate" style={{ fontFamily: f.googleFont ?? f.nom }}>
                    L'Écho des Plumes
                  </p>
                </div>
              ))
          }
        </>}
      </div>

      {uploading && (
        <div className="p-2 text-xs text-center text-gray-400 border-t flex-shrink-0">Envoi en cours…</div>
      )}
    </div>
  )
}
