import { useState, useEffect, useRef } from 'react'
import { instagram } from '../../shared/api.js'

const TABS = [
  { id: 'backgrounds', label: 'Fonds' },
  { id: 'elements',    label: 'Éléments' },
  { id: 'fonts',       label: 'Polices' },
  { id: 'couleurs',    label: 'Couleurs' },
]

export default function IgBibliotheques() {
  const [tab, setTab] = useState('backgrounds')

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-4 pt-3 border-b border-gray-200 bg-white">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === t.id ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'backgrounds' && <BgLibrary />}
        {tab === 'elements'    && <ElLibrary />}
        {tab === 'fonts'       && <FontLibrary />}
        {tab === 'couleurs'    && <CouleurLibrary />}
      </div>
    </div>
  )
}

// ── Fonds ─────────────────────────────────────────────────────────────────────

function BgLibrary() {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [nom, setNom]       = useState('')
  const fileRef             = useRef(null)

  async function load() {
    setLoading(true)
    setItems(await instagram.getBackgrounds().catch(() => []))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function upload() {
    const file = fileRef.current?.files[0]
    if (!file || !nom.trim()) return
    const fd = new FormData()
    fd.append('fichier', file)
    fd.append('nom', nom)
    await instagram.createBackground(fd)
    setNom(''); fileRef.current.value = ''
    load()
  }

  return (
    <LibraryLayout
      title="Fonds d'écran"
      addForm={
        <div className="flex gap-2 items-end flex-wrap">
          <input type="text" value={nom} onChange={e => setNom(e.target.value)}
            placeholder="Nom" className="border rounded px-3 py-1.5 text-sm" />
          <input type="file" ref={fileRef} accept="image/*" className="text-sm" />
          <button onClick={upload} className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600">
            Importer
          </button>
        </div>
      }
    >
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map(bg => (
            <div key={bg.id} className="relative group">
              <div className="aspect-square rounded border overflow-hidden bg-gray-100">
                <img src={`/uploads/instagram/backgrounds/${bg.fichier}`} alt={bg.nom}
                  className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-gray-600 truncate mt-1">{bg.nom}</p>
              {bg.estDefaut && <span className="text-xs text-pink-500 font-medium">Défaut</span>}
              <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                {!bg.estDefaut && (
                  <button onClick={() => instagram.setDefaultBackground(bg.id).then(load)}
                    className="px-1.5 py-0.5 text-xs bg-white border rounded shadow">★</button>
                )}
                <button onClick={() => instagram.deleteBackground(bg.id).then(load)}
                  className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded shadow">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </LibraryLayout>
  )
}

// ── Éléments ──────────────────────────────────────────────────────────────────

function ElLibrary() {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [nom, setNom]       = useState('')
  const [tags, setTags]     = useState('')
  const [search, setSearch] = useState('')
  const fileRef             = useRef(null)

  async function load(tag) {
    setLoading(true)
    setItems(await instagram.getElements(tag || undefined).catch(() => []))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function upload() {
    const file = fileRef.current?.files[0]
    if (!file || !nom.trim()) return
    const fd = new FormData()
    fd.append('fichier', file)
    fd.append('nom', nom)
    fd.append('tags', tags)
    await instagram.createElement(fd)
    setNom(''); setTags(''); fileRef.current.value = ''
    load()
  }

  return (
    <LibraryLayout
      title="Éléments graphiques"
      addForm={
        <div className="flex gap-2 items-end flex-wrap">
          <input type="text" value={nom} onChange={e => setNom(e.target.value)}
            placeholder="Nom" className="border rounded px-3 py-1.5 text-sm" />
          <input type="text" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="Mots-clés (virgules)" className="border rounded px-3 py-1.5 text-sm" />
          <input type="file" ref={fileRef} accept="image/*" className="text-sm" />
          <button onClick={upload} className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600">
            Importer
          </button>
        </div>
      }
    >
      <div className="mb-3 flex gap-2">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par mot-clé…"
          className="border rounded px-3 py-1.5 text-sm w-56"
        />
        <button onClick={() => load(search)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
          Rechercher
        </button>
        {search && <button onClick={() => { setSearch(''); load() }} className="text-sm text-gray-400 hover:text-gray-600">Réinitialiser</button>}
      </div>
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map(el => (
            <div key={el.id} className="relative group">
              <div className="aspect-square rounded border overflow-hidden bg-gray-100">
                <img src={`/uploads/instagram/elements/${el.fichier}`} alt={el.nom}
                  className="w-full h-full object-contain p-1" />
              </div>
              <p className="text-xs text-gray-600 truncate mt-1">{el.nom}</p>
              {el.tags && <p className="text-xs text-gray-400 truncate">{el.tags}</p>}
              <button
                onClick={() => instagram.deleteElement(el.id).then(load)}
                className="absolute top-1 right-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded shadow hidden group-hover:block"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </LibraryLayout>
  )
}

// ── Polices ───────────────────────────────────────────────────────────────────

function FontLibrary() {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [nom, setNom]       = useState('')
  const [googleFont, setGoogleFont] = useState('')
  const [defTitre, setDefTitre] = useState(false)
  const [defTexte, setDefTexte] = useState(false)
  const fileRef = useRef(null)

  async function load() {
    setLoading(true)
    setItems(await instagram.getFonts().catch(() => []))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!nom.trim()) return
    const fd = new FormData()
    fd.append('nom', nom)
    if (fileRef.current?.files[0]) fd.append('fichier', fileRef.current.files[0])
    if (googleFont.trim()) fd.append('googleFont', googleFont.trim())
    fd.append('estDefautTitre', defTitre)
    fd.append('estDefautTexte', defTexte)
    await instagram.createFont(fd)
    setNom(''); setGoogleFont(''); setDefTitre(false); setDefTexte(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  return (
    <LibraryLayout
      title="Bibliothèque de polices"
      addForm={
        <div className="flex gap-2 items-end flex-wrap">
          <input type="text" value={nom} onChange={e => setNom(e.target.value)}
            placeholder="Nom affiché" className="border rounded px-3 py-1.5 text-sm" />
          <input type="text" value={googleFont} onChange={e => setGoogleFont(e.target.value)}
            placeholder="Google Font (ex: Playfair Display)" className="border rounded px-3 py-1.5 text-sm w-52" />
          <span className="text-xs text-gray-400">ou</span>
          <input type="file" ref={fileRef} accept=".ttf,.otf,.woff,.woff2" className="text-sm" />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={defTitre} onChange={e => setDefTitre(e.target.checked)} />
            Titre
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={defTexte} onChange={e => setDefTexte(e.target.checked)} />
            Texte
          </label>
          <button onClick={add} className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600">
            Ajouter
          </button>
        </div>
      }
    >
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {items.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 border rounded bg-white">
              <span className="text-lg flex-1" style={{ fontFamily: f.nom }}>{f.nom}</span>
              <div className="flex gap-1 text-xs">
                {f.estDefautTitre && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Titre</span>}
                {f.estDefautTexte && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Texte</span>}
                {f.googleFont && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Google</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => instagram.setDefaultFont(f.id, 'titre').then(load)}
                  className="px-2 py-0.5 text-xs border rounded hover:bg-gray-50">→ Titre</button>
                <button onClick={() => instagram.setDefaultFont(f.id, 'texte').then(load)}
                  className="px-2 py-0.5 text-xs border rounded hover:bg-gray-50">→ Texte</button>
                <button onClick={() => instagram.deleteFont(f.id).then(load)}
                  className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </LibraryLayout>
  )
}

// ── Couleurs ──────────────────────────────────────────────────────────────────

function CouleurLibrary() {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [nom, setNom]       = useState('')
  const [valeur, setValeur] = useState('#000000')

  async function load() {
    setLoading(true)
    setItems(await instagram.getCouleurs().catch(() => []))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!nom.trim()) return
    await instagram.createCouleur({ nom, valeur })
    setNom('')
    load()
  }

  return (
    <LibraryLayout
      title="Palette personnalisée"
      addForm={
        <div className="flex gap-2 items-end">
          <input type="color" value={valeur} onChange={e => setValeur(e.target.value)}
            className="h-9 w-14 border rounded cursor-pointer" />
          <input type="text" value={nom} onChange={e => setNom(e.target.value)}
            placeholder="Nom (ex: Rose maison)" className="border rounded px-3 py-1.5 text-sm" />
          <button onClick={add} className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600">
            Ajouter
          </button>
        </div>
      }
    >
      {loading ? <Spinner /> : (
        <div className="flex flex-wrap gap-3">
          {items.map(c => (
            <div key={c.id} className="flex items-center gap-2 p-2 border rounded bg-white group">
              <div className="w-8 h-8 rounded border" style={{ background: c.valeur }} />
              <div>
                <p className="text-sm font-medium">{c.nom}</p>
                <p className="text-xs text-gray-400">{c.valeur}</p>
              </div>
              <button
                onClick={() => instagram.deleteCouleur(c.id).then(load)}
                className="ml-2 text-gray-300 hover:text-red-500 hidden group-hover:block"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </LibraryLayout>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LibraryLayout({ title, addForm, children }) {
  return (
    <div>
      <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {addForm}
      </div>
      {children}
    </div>
  )
}

function Spinner() {
  return <div className="text-center py-8 text-gray-400 text-sm">Chargement…</div>
}
