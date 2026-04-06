import { useState, useEffect } from 'react'
import { instagram } from '../../shared/api.js'

const FILTRES = [
  { id: 'en_attente', label: 'En attente', color: 'yellow' },
  { id: 'envoye',     label: 'Envoyés',    color: 'green' },
  { id: 'ignore',     label: 'Ignorés',    color: 'gray' },
]

export default function IgMessages() {
  const [tab, setTab]           = useState('brouillons')  // 'brouillons' | 'exclusions' | 'config'
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-4 pt-3 border-b border-gray-200 bg-white">
        {[
          { id: 'brouillons',  label: 'Brouillons' },
          { id: 'exclusions',  label: 'Exclusions' },
          { id: 'config',      label: 'Configuration' },
        ].map(t => (
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
        {tab === 'brouillons'  && <BrouillonsPanel />}
        {tab === 'exclusions'  && <ExclusionsPanel />}
        {tab === 'config'      && <ConfigPanel />}
      </div>
    </div>
  )
}

// ── Brouillons ────────────────────────────────────────────────────────────────

function BrouillonsPanel() {
  const [filtre, setFiltre]       = useState('en_attente')
  const [brouillons, setBrouillons] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState({}) // { [id]: texte }
  const [busy, setBusy]           = useState(null)

  async function load() {
    setLoading(true)
    setBrouillons(await instagram.getBrouillons(filtre).catch(() => []))
    setLoading(false)
  }

  useEffect(() => { load() }, [filtre])

  async function envoyer(b) {
    setBusy(b.id)
    try {
      // Si édité, sauvegarder d'abord
      if (editing[b.id] !== undefined) {
        await instagram.updateBrouillon(b.id, { textePropose: editing[b.id] })
      }
      await instagram.envoyerBrouillon(b.id)
      setEditing(prev => { const n = { ...prev }; delete n[b.id]; return n })
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function ignorer(id) {
    setBusy(id)
    try {
      await instagram.ignorerBrouillon(id)
      load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {/* Filtres */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTRES.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltre(f.id)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              filtre === f.id
                ? 'bg-pink-500 text-white border-pink-500'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1 text-sm border rounded hover:bg-gray-50">
          ↻ Actualiser
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Chargement…</p>
      ) : brouillons.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">Aucun brouillon {filtre === 'en_attente' ? 'en attente' : filtre}</p>
          {filtre === 'en_attente' && (
            <p className="text-xs mt-1">
              Les nouveaux commentaires et messages arriveront ici via le webhook Meta
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {brouillons.map(b => {
            const texte = editing[b.id] ?? b.textePropose ?? ''
            const isDirty = editing[b.id] !== undefined
            return (
              <div key={b.id} className="border rounded-lg p-4 bg-white shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      b.type === 'commentaire'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {b.type === 'commentaire' ? '💬 Commentaire' : '✉️ Message'}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      @{b.igAuteurNom ?? b.igAuteurId}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(b.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    b.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-700' :
                    b.statut === 'envoye'     ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {b.statut === 'en_attente' ? 'En attente' : b.statut === 'envoye' ? 'Envoyé' : 'Ignoré'}
                  </span>
                </div>

                {/* Message original */}
                <div className="bg-gray-50 rounded p-3 mb-3">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Message original :</p>
                  <p className="text-sm text-gray-700">{b.messageOriginal}</p>
                </div>

                {/* Réponse proposée */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1 font-medium">
                    Réponse proposée par EVA{isDirty ? ' (modifiée)' : ''} :
                  </p>
                  {b.statut === 'en_attente' ? (
                    <textarea
                      value={texte}
                      onChange={e => setEditing(prev => ({ ...prev, [b.id]: e.target.value }))}
                      className="w-full border rounded px-3 py-2 text-sm resize-none"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{b.textePropose}</p>
                  )}
                </div>

                {/* Actions */}
                {b.statut === 'en_attente' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => envoyer(b)}
                      disabled={busy === b.id}
                      className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                    >
                      {busy === b.id ? 'Envoi…' : '✓ Envoyer'}
                    </button>
                    <button
                      onClick={() => ignorer(b.id)}
                      disabled={busy === b.id}
                      className="px-3 py-1.5 text-sm border rounded text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Ignorer
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Exclusions ────────────────────────────────────────────────────────────────

function ExclusionsPanel() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [igUserId, setIgUserId] = useState('')
  const [nom, setNom]         = useState('')
  const [note, setNote]       = useState('')

  async function load() {
    setLoading(true)
    setItems(await instagram.getExclusions().catch(() => []))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!igUserId.trim() || !nom.trim()) return
    await instagram.createExclusion({ igUserId, nom, note })
    setIgUserId(''); setNom(''); setNote('')
    load()
  }

  return (
    <div>
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          Les contacts dans cette liste ne recevront jamais de réponse automatique d'EVA.
          Leurs messages et commentaires seront ignorés silencieusement.
        </p>
      </div>

      {/* Formulaire ajout */}
      <div className="flex gap-2 mb-4 flex-wrap items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">ID Instagram</label>
          <input type="text" value={igUserId} onChange={e => setIgUserId(e.target.value)}
            placeholder="123456789" className="border rounded px-3 py-1.5 text-sm w-36" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nom affiché</label>
          <input type="text" value={nom} onChange={e => setNom(e.target.value)}
            placeholder="@pseudo" className="border rounded px-3 py-1.5 text-sm w-36" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Note (optionnel)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ex: ami proche" className="border rounded px-3 py-1.5 text-sm w-40" />
        </div>
        <button onClick={add} disabled={!igUserId.trim() || !nom.trim()}
          className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-40">
          Ajouter
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune exclusion configurée.</p>
      ) : (
        <div className="space-y-2">
          {items.map(ex => (
            <div key={ex.id} className="flex items-center gap-3 p-3 border rounded bg-white">
              <div className="flex-1">
                <p className="text-sm font-medium">{ex.nom}</p>
                <p className="text-xs text-gray-400">ID: {ex.igUserId}{ex.note ? ` — ${ex.note}` : ''}</p>
              </div>
              <button onClick={() => instagram.deleteExclusion(ex.id).then(load)}
                className="text-red-400 hover:text-red-600 text-sm">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Configuration ─────────────────────────────────────────────────────────────

function ConfigPanel() {
  const [autoReply, setAutoReply] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    instagram.getConfig().then(params => {
      const ar = params.find(p => p.cle === 'instagram.auto_reply')
      if (ar) setAutoReply(ar.valeur === 'true')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    await instagram.setConfig('instagram.auto_reply', autoReply ? 'true' : 'false')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-sm text-gray-400">Chargement…</p>

  const webhookUrl = `${window.location.origin}/api/instagram/webhook`

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-base font-semibold">Configuration Meta API</h2>

      {/* Réponse automatique */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium">Mode de réponse</h3>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={!autoReply} onChange={() => setAutoReply(false)} />
            <div>
              <p className="text-sm font-medium">Brouillons</p>
              <p className="text-xs text-gray-500">EVA propose une réponse — vous validez avant envoi</p>
            </div>
          </label>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={autoReply} onChange={() => setAutoReply(true)} />
            <div>
              <p className="text-sm font-medium">Réponse automatique</p>
              <p className="text-xs text-gray-500">EVA répond directement (sauf contacts exclus)</p>
            </div>
          </label>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-50">
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          {saved && <span className="text-sm text-green-600">Sauvegardé ✓</span>}
        </div>
      </div>

      {/* Info webhook */}
      <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
        <h3 className="text-sm font-medium">Configuration du webhook Meta</h3>
        <p className="text-xs text-gray-600">
          Dans Meta Developer → votre App → Instagram → Webhooks, configurez :
        </p>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">URL du webhook :</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border rounded px-3 py-1.5 text-xs font-mono break-all">
                {webhookUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                className="px-2 py-1 text-xs border rounded hover:bg-white flex-shrink-0"
              >
                Copier
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Token de vérification :</p>
            <p className="text-xs text-gray-600">
              Valeur de <code>META_WEBHOOK_VERIFY_TOKEN</code> dans votre fichier <code>.env</code>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Champs à souscrire :</p>
            <p className="text-xs text-gray-600">
              <code>comments</code>, <code>messages</code>
            </p>
          </div>
        </div>
      </div>

      {/* Clés .env */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-medium mb-2">Variables d'environnement requises</h3>
        <div className="space-y-1 font-mono text-xs text-gray-700">
          {[
            ['META_ACCESS_TOKEN', 'Page Access Token (long-lived)'],
            ['META_IG_USER_ID', 'ID du compte Instagram Business'],
            ['META_WEBHOOK_VERIFY_TOKEN', 'Token secret webhook (choisissez librement)'],
            ['META_APP_SECRET', 'App Secret (Meta Developer → App Settings)'],
          ].map(([key, desc]) => (
            <div key={key} className="flex gap-2">
              <code className="text-pink-600 flex-shrink-0">{key}</code>
              <span className="text-gray-500 font-sans text-xs">— {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
