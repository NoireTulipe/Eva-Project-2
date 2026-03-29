import { useState, useEffect } from 'react'
import { admin } from '../../../shared/api.js'

const CATEGORIES_DISPO = ['ventes', 'memoire', 'web']

export default function Parametrage() {
  const [onglet, setOnglet] = useState('prompts')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Paramétrage EVA</h1>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { id: 'prompts', label: 'Prompts' },
          { id: 'config',  label: 'Config LLM' },
          { id: 'discord', label: 'Discord' }
        ].map(o => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              onglet === o.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'prompts' && <OngletPrompts />}
      {onglet === 'config'  && <OngletConfig />}
      {onglet === 'discord' && <OngletDiscord />}
    </div>
  )
}

// ─── Onglet Prompts ───────────────────────────────────────────────────────────

function OngletPrompts() {
  const [prompts, setPrompts] = useState([])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    admin.getPrompts().then(setPrompts).catch(() => setError('Erreur chargement'))
  }, [])

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const updated = await admin.updatePrompt(editing.id, { contenu: editing.contenu })
      setPrompts(prev => prev.map(p => p.id === updated.id ? updated : p))
      setEditing(null)
    } catch {
      setError('Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActif(p) {
    const updated = await admin.updatePrompt(p.id, { actif: !p.actif })
    setPrompts(prev => prev.map(x => x.id === updated.id ? updated : x))
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div className="space-y-4">
      {prompts.map(p => (
        <div key={p.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-medium text-gray-800">{p.module}</span>
              <span className="mx-2 text-gray-400">·</span>
              <span className="text-sm text-gray-500">{p.role}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleActif(p)}
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  p.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.actif ? 'Actif' : 'Inactif'}
              </button>
              <button
                onClick={() => editing?.id === p.id ? setEditing(null) : setEditing({ id: p.id, contenu: p.contenu })}
                className="text-sm text-indigo-600 hover:underline"
              >
                {editing?.id === p.id ? 'Annuler' : 'Modifier'}
              </button>
            </div>
          </div>

          {editing?.id === p.id ? (
            <div>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={12}
                value={editing.contenu}
                onChange={e => setEditing(prev => ({ ...prev, contenu: e.target.value }))}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          ) : (
            <pre className="text-xs text-gray-600 bg-gray-50 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap">
              {p.contenu}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Onglet Config LLM ────────────────────────────────────────────────────────

function OngletConfig() {
  const [params, setParams] = useState([])
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    admin.getConfig().then(data => {
      setParams(data)
      setEditValues(Object.fromEntries(data.map(p => [p.id, p.valeur])))
    }).catch(() => setError('Erreur chargement'))
  }, [])

  async function save(p) {
    setSaving(p.id)
    try {
      const updated = await admin.updateConfig(p.id, editValues[p.id])
      setParams(prev => prev.map(x => x.id === updated.id ? updated : x))
    } catch {
      setError('Erreur sauvegarde')
    } finally {
      setSaving(null)
    }
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Clé</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Valeur</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {params.map(p => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.cle}</td>
              <td className="px-4 py-3">
                <input
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={editValues[p.id] ?? ''}
                  onChange={e => setEditValues(prev => ({ ...prev, [p.id]: e.target.value }))}
                />
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{p.description}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => save(p)}
                  disabled={saving === p.id || editValues[p.id] === p.valeur}
                  className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40"
                >
                  {saving === p.id ? '…' : 'OK'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Onglet Discord ───────────────────────────────────────────────────────────

const CANAL_VIDE = { channelId: '', nom: '', mode: 'conversation', categories: [] }

function OngletDiscord() {
  const [canaux, setCanaux] = useState([])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    admin.getCanaux().then(data =>
      setCanaux(data.map(c => ({ ...c, categories: JSON.parse(c.categories || '[]') })))
    ).catch(() => setError('Erreur chargement'))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      if (form.id) {
        const updated = await admin.updateCanal(form.id, {
          nom: form.nom, mode: form.mode, categories: form.categories, actif: form.actif
        })
        setCanaux(prev => prev.map(c => c.id === updated.id
          ? { ...updated, categories: JSON.parse(updated.categories || '[]') }
          : c
        ))
      } else {
        const created = await admin.createCanal({
          channelId: form.channelId, nom: form.nom, mode: form.mode, categories: form.categories
        })
        setCanaux(prev => [...prev, { ...created, categories: JSON.parse(created.categories || '[]') }])
      }
      setForm(null)
    } catch (e) {
      setError(e.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce canal ?')) return
    await admin.deleteCanal(id)
    setCanaux(prev => prev.filter(c => c.id !== id))
  }

  function toggleCategory(cat) {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }))
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Canal non configuré → mode <strong>conversation</strong> par défaut.
        </p>
        <button
          onClick={() => setForm({ ...CANAL_VIDE })}
          className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          + Ajouter un canal
        </button>
      </div>

      {canaux.length === 0 && !form && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-400">
          Aucun canal configuré
        </div>
      )}

      {canaux.map(c => (
        <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-start justify-between">
          <div>
            <div className="font-medium text-gray-800">{c.nom}</div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">{c.channelId}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                c.mode === 'outils' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {c.mode}
              </span>
              {c.categories.map(cat => (
                <span key={cat} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  {cat}
                </span>
              ))}
              {!c.actif && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">inactif</span>
              )}
            </div>
          </div>
          <div className="flex gap-3 ml-4 flex-shrink-0">
            <button onClick={() => setForm({ ...c })} className="text-sm text-indigo-600 hover:underline">
              Modifier
            </button>
            <button onClick={() => handleDelete(c.id)} className="text-sm text-red-500 hover:underline">
              Supprimer
            </button>
          </div>
        </div>
      ))}

      {form && (
        <div className="bg-white rounded-lg border-2 border-indigo-200 p-5 space-y-4">
          <h3 className="font-medium text-gray-800">{form.id ? 'Modifier le canal' : 'Nouveau canal'}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">ID du canal Discord</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="123456789012345678"
                value={form.channelId}
                onChange={e => setForm(p => ({ ...p, channelId: e.target.value }))}
                disabled={!!form.id}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nom lisible</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="ex: #general"
                value={form.nom}
                onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Mode</label>
            <div className="flex flex-col gap-2">
              {[
                { val: 'conversation', label: 'Conversation — Pro direct + mémoire, aucun outil' },
                { val: 'outils',       label: 'Outils — Flash + outils filtrés + Pro' }
              ].map(({ val, label }) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="mode" value={val}
                    checked={form.mode === val}
                    onChange={() => setForm(p => ({ ...p, mode: val }))}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {form.mode === 'outils' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">
                Catégories d'outils autorisées
              </label>
              <div className="flex gap-4">
                {CATEGORIES_DISPO.map(cat => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.categories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-gray-700">{cat}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.id && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.actif}
                onChange={() => setForm(p => ({ ...p, actif: !p.actif }))}
                className="accent-indigo-600"
              />
              <span className="text-sm text-gray-700">Canal actif</span>
            </label>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setForm(null)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.channelId || !form.nom}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
