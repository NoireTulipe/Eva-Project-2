import { useState, useEffect } from 'react'
import { memoire as memoireApi } from '../../../shared/api.js'

const TABS = [
  { id: 'souvenirs', label: 'Souvenirs' },
  { id: 'preferences', label: 'Préférences' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'buffer', label: 'Buffer' },
]

function Badge({ count, color = 'gray' }) {
  const colors = { gray: 'bg-gray-100 text-gray-600', indigo: 'bg-indigo-100 text-indigo-700', amber: 'bg-amber-100 text-amber-700' }
  return <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${colors[color]}`}>{count}</span>
}

function ConfirmBtn({ onConfirm, label = 'Supprimer', className = '' }) {
  const [step, setStep] = useState(0)
  if (step === 0) return (
    <button onClick={() => setStep(1)} className={`text-xs text-red-500 hover:text-red-700 ${className}`}>{label}</button>
  )
  return (
    <span className="flex gap-1">
      <button onClick={() => { onConfirm(); setStep(0) }} className="text-xs text-red-600 font-medium hover:text-red-800">Confirmer</button>
      <button onClick={() => setStep(0)} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
    </span>
  )
}

function EditableRow({ children, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  return editing
    ? children({ editing: true, done: () => setEditing(false) })
    : (
      <div className="flex items-start gap-2 group">
        <div className="flex-1">{children({ editing: false })}</div>
        <div className="flex-shrink-0 hidden group-hover:flex gap-2 mt-0.5">
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-indigo-600">Modifier</button>
          <ConfirmBtn onConfirm={onDelete} />
        </div>
      </div>
    )
}

// ─── ONGLET SOUVENIRS ─────────────────────────────────────────────────────────

function TabSouvenirs() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newContenu, setNewContenu] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setItems(await memoireApi.getSouvenirs()) } finally { setLoading(false) }
  }

  async function add() {
    if (!newContenu.trim()) return
    setSaving(true)
    try {
      const item = await memoireApi.createSouvenir(newContenu.trim())
      setItems(prev => [item, ...prev])
      setNewContenu('')
    } finally { setSaving(false) }
  }

  async function update(id, contenu) {
    const updated = await memoireApi.updateSouvenir(id, contenu)
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  async function remove(id) {
    await memoireApi.deleteSouvenir(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Chargement...</div>

  return (
    <div className="space-y-4">
      {/* Ajout */}
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Ajouter un souvenir…"
          value={newContenu}
          onChange={e => setNewContenu(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          disabled={!newContenu.trim() || saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>

      {/* Liste */}
      {items.length === 0 && <p className="text-sm text-gray-400">Aucun souvenir pour l'instant.</p>}
      <div className="space-y-2">
        {items.map(item => (
          <EditableRow key={item.id} onDelete={() => remove(item.id)}>
            {({ editing, done }) => editing ? (
              <EditField
                value={item.contenu}
                onSave={val => { update(item.id, val); done() }}
                onCancel={done}
                multiline
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                <p className="text-sm text-gray-800">{item.contenu}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(item.createdAt)}</p>
              </div>
            )}
          </EditableRow>
        ))}
      </div>
    </div>
  )
}

// ─── ONGLET PRÉFÉRENCES ───────────────────────────────────────────────────────

function TabPreferences() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCle, setNewCle] = useState('')
  const [newContenu, setNewContenu] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setItems(await memoireApi.getPreferences()) } finally { setLoading(false) }
  }

  async function add() {
    if (!newCle.trim() || !newContenu.trim()) return
    setSaving(true)
    try {
      const item = await memoireApi.createPreference(newCle.trim(), newContenu.trim())
      setItems(prev => [...prev, item].sort((a, b) => a.cle.localeCompare(b.cle)))
      setNewCle('')
      setNewContenu('')
    } finally { setSaving(false) }
  }

  async function update(id, data) {
    const updated = await memoireApi.updatePreference(id, data)
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  async function remove(id) {
    await memoireApi.deletePreference(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Chargement...</div>

  return (
    <div className="space-y-4">
      {/* Ajout */}
      <div className="flex gap-2">
        <input
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Clé (ex: langue)"
          value={newCle}
          onChange={e => setNewCle(e.target.value)}
        />
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Valeur…"
          value={newContenu}
          onChange={e => setNewContenu(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          disabled={!newCle.trim() || !newContenu.trim() || saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>

      {/* Liste */}
      {items.length === 0 && <p className="text-sm text-gray-400">Aucune préférence enregistrée.</p>}
      <div className="space-y-2">
        {items.map(item => (
          <EditableRow key={item.id} onDelete={() => remove(item.id)}>
            {({ editing, done }) => editing ? (
              <div className="flex gap-2">
                <EditField
                  value={item.cle}
                  onSave={cle => update(item.id, { cle, contenu: item.contenu })}
                  onCancel={() => {}}
                  className="w-36"
                  inline
                />
                <EditField
                  value={item.contenu}
                  onSave={contenu => { update(item.id, { cle: item.cle, contenu }); done() }}
                  onCancel={done}
                  className="flex-1"
                  inline
                />
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-start gap-3">
                <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded flex-shrink-0">{item.cle}</span>
                <p className="text-sm text-gray-800 flex-1">{item.contenu}</p>
              </div>
            )}
          </EditableRow>
        ))}
      </div>
    </div>
  )
}

// ─── ONGLET CONTACTS ──────────────────────────────────────────────────────────

function TabContacts() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newNom, setNewNom] = useState('')
  const [newContenu, setNewContenu] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setItems(await memoireApi.getContacts()) } finally { setLoading(false) }
  }

  async function add() {
    if (!newNom.trim() || !newContenu.trim()) return
    setSaving(true)
    try {
      const item = await memoireApi.createContact(newNom.trim(), newContenu.trim())
      setItems(prev => [...prev, item].sort((a, b) => a.nom.localeCompare(b.nom)))
      setNewNom('')
      setNewContenu('')
    } finally { setSaving(false) }
  }

  async function update(id, data) {
    const updated = await memoireApi.updateContact(id, data)
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  async function remove(id) {
    await memoireApi.deleteContact(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Chargement...</div>

  return (
    <div className="space-y-4">
      {/* Ajout */}
      <div className="flex gap-2">
        <input
          className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Nom du contact"
          value={newNom}
          onChange={e => setNewNom(e.target.value)}
        />
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Ce qu'EVA sait de cette personne…"
          value={newContenu}
          onChange={e => setNewContenu(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          disabled={!newNom.trim() || !newContenu.trim() || saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>

      {/* Liste */}
      {items.length === 0 && <p className="text-sm text-gray-400">Aucun contact mémorisé.</p>}
      <div className="space-y-2">
        {items.map(item => (
          <EditableRow key={item.id} onDelete={() => remove(item.id)}>
            {({ editing, done }) => editing ? (
              <div className="space-y-1">
                <EditField value={item.nom} onSave={nom => update(item.id, { nom, contenu: item.contenu })} onCancel={() => {}} inline />
                <EditField value={item.contenu} onSave={contenu => { update(item.id, { nom: item.nom, contenu }); done() }} onCancel={done} multiline />
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                <p className="text-sm font-semibold text-gray-800">{item.nom}</p>
                <p className="text-sm text-gray-600 mt-0.5">{item.contenu}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(item.createdAt)}</p>
              </div>
            )}
          </EditableRow>
        ))}
      </div>
    </div>
  )
}

// ─── ONGLET BUFFER ────────────────────────────────────────────────────────────

function TabBuffer({ onConsolidate }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'done'
  const [consolidating, setConsolidating] = useState(false)
  const [consolidationResult, setConsolidationResult] = useState(null)

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    try {
      const traite = filter === 'pending' ? false : filter === 'done' ? true : undefined
      setItems(await memoireApi.getBuffer(traite))
    } finally { setLoading(false) }
  }

  async function removeEntry(id) {
    await memoireApi.deleteBufferEntry(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function clearAll() {
    if (!confirm('Vider tout le buffer affiché ?')) return
    const traite = filter === 'pending' ? false : filter === 'done' ? true : undefined
    await memoireApi.clearBuffer(traite)
    setItems([])
  }

  async function consolidate() {
    setConsolidating(true)
    setConsolidationResult(null)
    try {
      const result = await memoireApi.consolider()
      setConsolidationResult(result)
      onConsolidate?.()
      load()
    } catch (err) {
      setConsolidationResult({ erreur: err.message })
    } finally {
      setConsolidating(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Chargement...</div>

  const pendingCount = items.filter(i => !i.traite).length

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['all', 'Tous'], ['pending', 'À traiter'], ['done', 'Traités']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {l}
            </button>
          ))}
        </div>

        <button
          onClick={consolidate}
          disabled={consolidating || pendingCount === 0}
          className="ml-auto px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5"
        >
          {consolidating ? 'Consolidation…' : `Consolider maintenant (${pendingCount})`}
        </button>

        {items.length > 0 && (
          <ConfirmBtn onConfirm={clearAll} label="Vider" />
        )}
      </div>

      {/* Résultat consolidation */}
      {consolidationResult && !consolidationResult.erreur && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
          Consolidé : {consolidationResult.traites} entrées →{' '}
          {consolidationResult.nbSouvenirs} souvenirs,{' '}
          {consolidationResult.nbPrefs} préférences,{' '}
          {consolidationResult.nbContacts} contacts
        </div>
      )}
      {consolidationResult?.erreur && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          Erreur : {consolidationResult.erreur}
        </div>
      )}

      {/* Liste */}
      {items.length === 0 && <p className="text-sm text-gray-400">Buffer vide.</p>}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className={`bg-white border rounded-lg px-3 py-2 ${item.traite ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.traite ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                    {item.traite ? 'traité' : 'en attente'}
                  </span>
                  <span className="text-xs text-gray-400">{item.source}</span>
                  <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">{item.contenu}</p>
              </div>
              <ConfirmBtn onConfirm={() => removeEntry(item.id)} className="flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── COMPOSANT EDITIONFIELD ───────────────────────────────────────────────────

function EditField({ value, onSave, onCancel, multiline = false, inline = false, className = '' }) {
  const [val, setVal] = useState(value)
  if (inline || !multiline) return (
    <input
      className={`border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full ${className}`}
      value={val}
      autoFocus
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel() }}
    />
  )
  return (
    <textarea
      className={`border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full resize-none ${className}`}
      rows={3}
      value={val}
      autoFocus
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
    />
  )
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function Memoire() {
  const [tab, setTab] = useState('souvenirs')
  const [stats, setStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    try { setStats(await memoireApi.getStats()) } catch {}
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults(null)
    try {
      const results = await memoireApi.recherche(searchQuery.trim())
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const tabCounts = {
    souvenirs: stats?.souvenirs ?? '…',
    preferences: stats?.preferences ?? '…',
    contacts: stats?.contacts ?? '…',
    buffer: stats?.bufferNonTraite != null ? `${stats.bufferNonTraite} / ${stats.bufferTotal}` : '…'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Mémoire d'EVA</h1>
        {stats && (
          <div className="text-xs text-gray-500 flex gap-4">
            <span>{stats.souvenirs} souvenirs</span>
            <span>{stats.preferences} préférences</span>
            <span>{stats.contacts} contacts</span>
            <span className={stats.bufferNonTraite > 0 ? 'text-amber-600 font-medium' : ''}>
              {stats.bufferNonTraite} en attente de consolidation
            </span>
          </div>
        )}
      </div>

      {/* Recherche sémantique */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Tester la recherche sémantique</p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Que sait EVA sur… ?"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={!searchQuery.trim() || searching}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-40"
          >
            {searching ? 'Recherche…' : 'Chercher'}
          </button>
        </form>

        {searchResults !== null && (
          <div className="mt-3 space-y-1">
            {searchResults.length === 0
              ? <p className="text-sm text-gray-400">Aucun résultat pertinent (seuil cosinus 0.45).</p>
              : searchResults.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                    r.type === 'souvenir' ? 'bg-blue-100 text-blue-700'
                    : r.type === 'preference' ? 'bg-purple-100 text-purple-700'
                    : 'bg-green-100 text-green-700'
                  }`}>{r.type}</span>
                  <span className="flex-1 text-gray-800">{r.cle ? `${r.cle} : ` : ''}{r.nom ? `${r.nom} : ` : ''}{r.contenu}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{(r.score * 100).toFixed(0)}%</span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <Badge
                count={tabCounts[t.id]}
                color={t.id === 'buffer' && stats?.bufferNonTraite > 0 ? 'amber' : 'gray'}
              />
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'souvenirs' && <TabSouvenirs />}
          {tab === 'preferences' && <TabPreferences />}
          {tab === 'contacts' && <TabContacts />}
          {tab === 'buffer' && <TabBuffer onConsolidate={loadStats} />}
        </div>
      </div>
    </div>
  )
}
