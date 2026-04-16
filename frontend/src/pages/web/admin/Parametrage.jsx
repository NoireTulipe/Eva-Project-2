import { useState, useEffect } from 'react'
import { admin, instagram } from '../../../shared/api.js'

const CATEGORIES_DISPO = ['ventes', 'memoire', 'web']

export default function Parametrage() {
  const [onglet, setOnglet] = useState('prompts')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Paramétrage EVA</h1>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { id: 'prompts',    label: 'Prompts' },
          { id: 'config',     label: 'Config LLM' },
          { id: 'discord',    label: 'Discord' },
          { id: 'instagram',  label: '📸 Instagram' },
          { id: 'notes',      label: '📌 Notes' },
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

      {onglet === 'prompts'   && <OngletPrompts />}
      {onglet === 'config'    && <OngletConfig />}
      {onglet === 'discord'   && <OngletDiscord />}
      {onglet === 'instagram' && <OngletInstagram />}
      {onglet === 'notes'     && <OngletNotes />}
    </div>
  )
}

// ─── Onglet Prompts ───────────────────────────────────────────────────────────

const MODULE_LABELS = {
  orchestrateur: { label: 'Orchestrateur (Flash)', desc: 'Interprète l\'intention et planifie les outils. Reçoit chaque message utilisateur.' },
  redacteur:     { label: 'Rédacteur (Pro)',        desc: 'Synthétise les résultats des outils en réponse naturelle.' },
  consolidation: { label: 'Consolidation mémoire',  desc: 'Extrait souvenirs, préférences et contacts depuis le buffer pour la mémoire long terme.' },
}

function OngletPrompts() {
  const [prompts, setPrompts] = useState([])
  const [tagsInfo, setTagsInfo] = useState(null)
  const [editing, setEditing] = useState(null)         // { id, contenu }
  const [preview, setPreview] = useState(null)          // { template, resolu, source }
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(null)
  const [error, setError] = useState('')
  const [showTags, setShowTags] = useState(false)

  useEffect(() => {
    Promise.all([
      admin.getPrompts(),
      admin.getPromptTags()
    ]).then(([p, t]) => {
      setPrompts(p)
      setTagsInfo(t)
    }).catch(() => setError('Erreur chargement'))
  }, [])

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const updated = await admin.updatePrompt(editing.id, { contenu: editing.contenu })
      setPrompts(prev => prev.map(p => p.id === updated.id ? updated : p))
      setEditing(null)
      setPreview(null)
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

  async function handlePreview(promptId, contenu) {
    setPreviewLoading(true)
    setPreview(null)
    try {
      const result = await admin.previewPrompt(promptId, contenu)
      setPreview(result)
    } catch {
      setError('Erreur prévisualisation')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleReset(p) {
    if (!confirm(`Remettre le prompt "${p.module}" aux valeurs par défaut ? Ton contenu actuel sera perdu.`)) return
    setResetting(p.id)
    try {
      const updated = await admin.resetPrompt(p.id)
      setPrompts(prev => prev.map(x => x.id === updated.id ? updated : x))
      if (editing?.id === p.id) setEditing({ id: p.id, contenu: updated.contenu })
      setPreview(null)
    } catch {
      setError('Erreur reset')
    } finally {
      setResetting(null)
    }
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div className="space-y-6">

      {/* Référence des tags */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTags(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-indigo-800 hover:bg-indigo-100 transition-colors"
        >
          <span>Référence des tags disponibles dans les prompts</span>
          <span className="text-indigo-500">{showTags ? '▲' : '▼'}</span>
        </button>

        {showTags && tagsInfo && (
          <div className="px-4 pb-4 space-y-4">
            {Object.entries(tagsInfo.tags).map(([module, tags]) => (
              <div key={module}>
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
                  {MODULE_LABELS[module]?.label ?? module}
                </p>
                <div className="space-y-2">
                  {tags.map(t => (
                    <div key={t.tag} className="bg-white rounded-lg border border-indigo-100 p-3">
                      <div className="flex items-start gap-3">
                        <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded flex-shrink-0">{t.tag}</code>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700">{t.description}</p>
                          {t.tag === '{{REGLES_MEMOIRE}}' && tagsInfo.valeurs_developpeur?.REGLES_MEMOIRE && (
                            <details className="mt-1">
                              <summary className="text-xs text-indigo-500 cursor-pointer">Voir le contenu injecté</summary>
                              <pre className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1 whitespace-pre-wrap overflow-auto max-h-32">
                                {tagsInfo.valeurs_developpeur.REGLES_MEMOIRE}
                              </pre>
                            </details>
                          )}
                          {t.exemple && t.tag !== '{{REGLES_MEMOIRE}}' && (
                            <pre className="text-xs text-gray-400 mt-1 italic whitespace-pre-wrap overflow-hidden text-ellipsis" style={{maxHeight:'2.5rem'}}>
                              ex: {t.exemple.slice(0, 120)}{t.exemple.length > 120 ? '…' : ''}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liste des prompts */}
      {prompts.map(p => {
        const isEditing = editing?.id === p.id
        const meta = MODULE_LABELS[p.module]
        return (
          <div key={p.id} className={`bg-white rounded-xl border-2 ${isEditing ? 'border-indigo-300' : 'border-gray-200'} overflow-hidden`}>

            {/* En-tête */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{meta?.label ?? p.module}</span>
                  <span className="text-xs text-gray-400">· {p.role}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {p.actif ? 'Actif — DB' : 'Inactif — fallback code'}
                  </span>
                </div>
                {meta?.desc && <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => toggleActif(p)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-500 hover:bg-gray-100"
                >
                  {p.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => handleReset(p)}
                  disabled={resetting === p.id}
                  className="text-xs px-2 py-1 border border-amber-300 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50"
                >
                  {resetting === p.id ? '…' : 'Reset défaut'}
                </button>
                <button
                  onClick={() => {
                    if (isEditing) { setEditing(null); setPreview(null) }
                    else setEditing({ id: p.id, contenu: p.contenu })
                  }}
                  className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  {isEditing ? 'Annuler' : 'Modifier'}
                </button>
              </div>
            </div>

            {/* Éditeur */}
            {isEditing ? (
              <div className="p-4 space-y-3">
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={14}
                  value={editing.contenu}
                  onChange={e => setEditing(prev => ({ ...prev, contenu: e.target.value }))}
                />
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => handlePreview(p.id, editing.contenu)}
                    disabled={previewLoading}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {previewLoading ? 'Calcul…' : 'Aperçu avec tags résolus'}
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                </div>

                {/* Prévisualisation */}
                {preview && preview.module === p.module && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between bg-gray-100 px-3 py-2">
                      <span className="text-xs font-medium text-gray-600">Prompt exact envoyé au LLM</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        preview.source === 'base_de_donnees' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {preview.source === 'base_de_donnees' ? 'Source : BDD (actif)' : 'Source : fallback code (inactif)'}
                      </span>
                    </div>
                    <pre className="text-xs text-gray-700 bg-white p-4 overflow-auto max-h-96 whitespace-pre-wrap">
                      {preview.resolu}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <pre className="text-xs text-gray-600 bg-gray-50 p-4 overflow-auto max-h-48 whitespace-pre-wrap">
                {p.contenu}
              </pre>
            )}
          </div>
        )
      })}
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
                c.mode === 'outils'       ? 'bg-blue-100 text-blue-700' :
                c.mode === 'exclu'        ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-600'
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
                { val: 'outils',       label: 'Outils — Flash + outils filtrés + Pro' },
                { val: 'exclu',        label: 'Exclure EVA — elle n\'écoute pas ce salon' }
              ].map(({ val, label }) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="mode" value={val}
                    checked={form.mode === val}
                    onChange={() => setForm(p => ({ ...p, mode: val }))}
                    className="accent-indigo-600"
                  />
                  <span className={`text-sm ${val === 'exclu' ? 'text-red-600' : 'text-gray-700'}`}>{label}</span>
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

// ─── Onglet Instagram ─────────────────────────────────────────────────────────

function OngletInstagram() {
  const [oauthStatus, setOauthStatus]   = useState(null)
  const [connecting, setConnecting]     = useState(false)
  const [prompts, setPrompts]           = useState([])
  const [edits, setEdits]               = useState({})
  const [saving, setSaving]             = useState(null)
  const [saved, setSaved]               = useState(null)
  const [discordChannelId, setDiscordChannelId] = useState('')
  const [discordParam, setDiscordParam] = useState(null)
  const [savingDiscord, setSavingDiscord] = useState(false)
  const [savedDiscord, setSavedDiscord] = useState(false)

  useEffect(() => {
    instagram.getOauthStatus().then(setOauthStatus).catch(() => {})
    admin.getPrompts().then(all => setPrompts(all.filter(p => p.module === 'instagram'))).catch(() => {})
    admin.getConfig().then(all => {
      const p = all.find(x => x.cle === 'discord.instagram.channel_id')
      if (p) { setDiscordParam(p); setDiscordChannelId(p.valeur ?? '') }
    }).catch(() => {})
  }, [])

  async function connecter() {
    setConnecting(true)
    try {
      const { url } = await instagram.getOauthUrl()
      window.location.href = url
    } catch (e) {
      alert(`Erreur : ${e.message}`)
      setConnecting(false)
    }
  }

  async function savePrompt(prompt) {
    setSaving(prompt.id)
    try {
      const contenu = edits[prompt.id] ?? prompt.contenu
      await admin.updatePrompt(prompt.id, { contenu })
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, contenu } : p))
      setEdits(prev => { const n = { ...prev }; delete n[prompt.id]; return n })
      setSaved(prompt.id)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  async function saveDiscordChannel() {
    if (!discordParam) return
    setSavingDiscord(true)
    try {
      await admin.updateConfig(discordParam.id, discordChannelId)
      setSavedDiscord(true)
      setTimeout(() => setSavedDiscord(false), 2000)
    } finally {
      setSavingDiscord(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Connexion OAuth Meta ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-sm text-gray-800">Connexion au compte Instagram</h3>
        <p className="text-xs text-gray-400">
          Nécessaire pour publier des posts. Token valide 60 jours, renouvelable ici.
        </p>

        {oauthStatus?.connected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              <span className="text-sm text-green-700 font-medium">Connecté</span>
              {oauthStatus.tokenSource === 'env' && (
                <span className="text-xs text-gray-400">(token .env)</span>
              )}
            </div>
            {oauthStatus.igUserId && (
              <p className="text-xs text-gray-500">ID compte : {oauthStatus.igUserId}</p>
            )}
            {oauthStatus.expiresAt && (
              <p className="text-xs text-gray-500">
                Token valide jusqu'au : {new Date(oauthStatus.expiresAt).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            )}
            <button onClick={connecter} disabled={connecting}
              className="px-3 py-1.5 text-xs border border-pink-200 text-pink-600 rounded hover:bg-pink-50 disabled:opacity-50">
              {connecting ? 'Redirection…' : 'Reconnecter / Renouveler le token'}
            </button>
            {oauthStatus.tokenSource === 'env' && (
              <p className="text-xs text-orange-500">
                ⚠ Token actuel provient du .env — après reconnexion il sera sauvegardé en base et le .env sera ignoré.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Autorisez EVA à accéder à votre compte Instagram pour publier.</p>
            <button onClick={connecter} disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium">
              {connecting ? 'Redirection vers Meta…' : '🔗 Connecter le compte Instagram'}
            </button>
            <p className="text-xs text-gray-400">
              Nécessite META_APP_ID et META_APP_SECRET dans le fichier .env du serveur.
            </p>
          </div>
        )}
      </div>

      {/* ── Salon Discord validation ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-sm text-gray-800">Salon Discord — validation Instafacile</h3>
        <p className="text-xs text-gray-400">
          EVA enverra les vignettes générées dans ce salon pour validation avant publication.
          Copiez l'ID du salon Discord (clic droit sur le salon → Copier l'identifiant).
        </p>
        {!discordParam ? (
          <p className="text-xs text-orange-600">
            Paramètre <code>discord.instagram.channel_id</code> introuvable en base.
            Ajoutez-le via : <code>INSERT INTO ConfigParam (cle, valeur) VALUES ('discord.instagram.channel_id', '');</code>
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={discordChannelId}
              onChange={e => setDiscordChannelId(e.target.value)}
              placeholder="ex: 1234567890123456789"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={saveDiscordChannel}
              disabled={savingDiscord || discordChannelId === (discordParam?.valeur ?? '')}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              {savingDiscord ? '…' : 'OK'}
            </button>
            {savedDiscord && <span className="text-sm text-green-600">Sauvegardé ✓</span>}
          </div>
        )}
      </div>

      {/* ── Prompt IA texte vignette ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-sm text-gray-800">Prompt IA — texte des vignettes</h3>
        <p className="text-xs text-gray-400">
          Utilisé par EVA lors de la génération automatique (Calendrier EVA) et par le générateur manuel dans l'éditeur.
        </p>

        {prompts.filter(p => p.role === 'texte_image').map(prompt => {
          const contenu = edits[prompt.id] ?? prompt.contenu
          const isDirty = edits[prompt.id] !== undefined
          return (
            <div key={prompt.id} className="space-y-2">
              <textarea
                value={contenu}
                onChange={e => setEdits(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={8}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => savePrompt(prompt)}
                  disabled={saving === prompt.id || !isDirty}
                  className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-40"
                >
                  {saving === prompt.id ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
                {isDirty && (
                  <button
                    onClick={() => setEdits(prev => { const n = { ...prev }; delete n[prompt.id]; return n })}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Annuler
                  </button>
                )}
                {saved === prompt.id && <span className="text-sm text-green-600">Sauvegardé ✓</span>}
              </div>
            </div>
          )
        })}

        {prompts.filter(p => p.role === 'texte_image').length === 0 && (
          <p className="text-xs text-orange-600">Prompt introuvable — relancez le seed.</p>
        )}
      </div>
    </div>
  )
}

// ─── Onglet Notes ─────────────────────────────────────────────────────────────

function OngletNotes() {
  const [params, setParams]         = useState({})       // { cle: { id, valeur } }
  const [edits, setEdits]           = useState({})
  const [saving, setSaving]         = useState(null)
  const [saved, setSaved]           = useState(null)
  const [error, setError]           = useState('')
  const [preview, setPreview]       = useState(null)     // aperçu live de la font

  const CLES = ['notes.police', 'notes.discord.channel_id']

  useEffect(() => {
    admin.getConfig().then(all => {
      const map = {}
      CLES.forEach(cle => {
        const p = all.find(x => x.cle === cle)
        if (p) map[cle] = p
      })
      setParams(map)
      setEdits(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.valeur ?? ''])))
      setPreview(map['notes.police']?.valeur || 'Caveat')
    }).catch(() => setError('Erreur chargement'))
  }, [])

  async function save(cle) {
    const p = params[cle]
    if (!p) return
    setSaving(cle)
    try {
      await admin.updateConfig(p.id, edits[cle])
      setParams(prev => ({ ...prev, [cle]: { ...p, valeur: edits[cle] } }))
      if (cle === 'notes.police') setPreview(edits[cle])
      setSaved(cle)
      setTimeout(() => setSaved(null), 2000)
    } catch {
      setError('Erreur sauvegarde')
    } finally {
      setSaving(null)
    }
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  // Injecter la Google Font pour le preview live
  useEffect(() => {
    if (!preview) return
    const id = 'google-font-admin-notes-preview'
    const ex = document.getElementById(id)
    if (ex) ex.remove()
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(preview)}:wght@400;700&display=swap`
    document.head.appendChild(link)
  }, [preview])

  return (
    <div className="space-y-6 max-w-xl">

      {/* ── Police Google Fonts ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-sm text-gray-800">Police des post-its</h3>
        <p className="text-xs text-gray-400">
          Nom exact d'une Google Font (ex : Caveat, Patrick Hand, Kalam, Indie Flower, Satisfy…).
          La police sera chargée automatiquement dans l'interface.
        </p>

        {!params['notes.police'] ? (
          <p className="text-xs text-orange-600">
            Paramètre <code>notes.police</code> introuvable — relancez le seed.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={edits['notes.police'] ?? ''}
                onChange={e => {
                  setEdits(p => ({ ...p, 'notes.police': e.target.value }))
                  setPreview(e.target.value)
                }}
                placeholder="ex: Caveat"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => save('notes.police')}
                disabled={saving === 'notes.police' || edits['notes.police'] === params['notes.police']?.valeur}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >
                {saving === 'notes.police' ? '…' : 'OK'}
              </button>
              {saved === 'notes.police' && <span className="text-sm text-green-600">✓</span>}
            </div>

            {/* Aperçu live */}
            {preview && (
              <div
                className="rounded-xl p-4 shadow-inner"
                style={{ backgroundColor: '#fef08a' }}
              >
                <p
                  className="text-base leading-relaxed"
                  style={{ fontFamily: `'${preview}', cursive`, color: '#1f2937' }}
                >
                  Voici à quoi ressemblent tes notes avec la police "{preview}". ✨
                </p>
              </div>
            )}

            <p className="text-xs text-gray-400">
              Suggestions : <span className="font-medium">Caveat · Patrick Hand · Kalam · Indie Flower · Satisfy · Nothing You Could Do · Architects Daughter</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Salon Discord rappels ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-sm text-gray-800">Salon Discord — rappels de notes</h3>
        <p className="text-xs text-gray-400">
          EVA enverra les rappels de notes dans ce salon Discord.
          Copiez l'ID du salon (clic droit sur le salon → Copier l'identifiant).
        </p>

        {!params['notes.discord.channel_id'] ? (
          <p className="text-xs text-orange-600">
            Paramètre <code>notes.discord.channel_id</code> introuvable — relancez le seed.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={edits['notes.discord.channel_id'] ?? ''}
              onChange={e => setEdits(p => ({ ...p, 'notes.discord.channel_id': e.target.value }))}
              placeholder="ex: 1234567890123456789"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => save('notes.discord.channel_id')}
              disabled={saving === 'notes.discord.channel_id' || edits['notes.discord.channel_id'] === params['notes.discord.channel_id']?.valeur}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              {saving === 'notes.discord.channel_id' ? '…' : 'OK'}
            </button>
            {saved === 'notes.discord.channel_id' && <span className="text-sm text-green-600">✓</span>}
          </div>
        )}
      </div>
    </div>
  )
}
