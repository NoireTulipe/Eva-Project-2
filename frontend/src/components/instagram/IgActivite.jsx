import { useState, useEffect } from 'react'
import { instagram } from '../../shared/api.js'

export default function IgActivite() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [limite, setLimite]       = useState(10)
  const [tab, setTab]             = useState('feed')   // 'feed' | 'commentaires' | 'messages'
  const [privateDMs, setPrivateDMs] = useState([])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setData(await instagram.getActivite(limite))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
    // DMs private API — chargement silencieux (non bloquant)
    instagram.getPrivateDMs(20).then(setPrivateDMs).catch(() => {})
  }

  useEffect(() => { load() }, [limite])

  if (loading) return <div className="p-6 text-sm text-gray-400 text-center">Chargement depuis Instagram…</div>
  if (error)   return (
    <div className="p-6 max-w-lg">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm font-medium text-red-700 mb-1">Impossible de récupérer l'activité</p>
        <p className="text-xs text-red-600">{error}</p>
        <p className="text-xs text-gray-500 mt-2">Vérifiez que META_ACCESS_TOKEN et META_IG_USER_ID sont configurés dans le .env.</p>
      </div>
    </div>
  )

  // Aplatir tous les commentaires récents
  const tousCommentaires = (data?.medias ?? []).flatMap(m =>
    (m.comments ?? []).map(c => ({ ...c, mediaCaption: m.caption?.slice(0, 50), mediaId: m.id }))
  ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  const conversations = data?.conversations ?? []
  const profil        = data?.profil
  const totalMessages = conversations.length + privateDMs.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Profil */}
      {profil && (
        <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-4 flex-wrap">
          {profil.profile_picture_url && (
            <img src={profil.profile_picture_url} alt={profil.username}
              className="w-10 h-10 rounded-full border" />
          )}
          <div>
            <p className="font-semibold text-sm">@{profil.username}</p>
            <p className="text-xs text-gray-500">{profil.name}</p>
          </div>
          <div className="flex gap-4 ml-auto text-center">
            <StatPill label="Publications" value={profil.media_count} />
            <StatPill label="Abonnés" value={fmtNum(profil.followers_count)} />
            <StatPill label="Abonnements" value={fmtNum(profil.follows_count)} />
          </div>
          <div className="flex items-center gap-2 ml-2">
            <label className="text-xs text-gray-500">Derniers</label>
            <select value={limite} onChange={e => setLimite(Number(e.target.value))}
              className="border rounded px-2 py-1 text-xs">
              {[5, 10, 20].map(n => <option key={n} value={n}>{n} posts</option>)}
            </select>
            <button onClick={load} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">↻</button>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 px-4 pt-2 bg-white border-b border-gray-200">
        {[
          { id: 'feed',         label: `Feed (${data?.medias?.length ?? 0})` },
          { id: 'commentaires', label: `Commentaires (${tousCommentaires.length})` },
          { id: 'messages',     label: `Messages (${totalMessages})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === t.id ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'feed'         && <FeedTab medias={data?.medias ?? []} />}
        {tab === 'commentaires' && <CommentairesTab commentaires={tousCommentaires} />}
        {tab === 'messages'     && <MessagesTab conversations={conversations} privateDMs={privateDMs} />}
      </div>
    </div>
  )
}

// ── Feed ──────────────────────────────────────────────────────────────────────

function FeedTab({ medias }) {
  if (!medias.length) return <Empty msg="Aucune publication trouvée." />
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {medias.map(m => (
        <div key={m.id} className="border rounded-lg overflow-hidden bg-white shadow-sm group">
          {/* Miniature */}
          <div className="aspect-square bg-gray-100 overflow-hidden">
            {(m.media_url || m.thumbnail_url) ? (
              <img src={m.thumbnail_url || m.media_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                {m.media_type === 'VIDEO' ? '▶' : '📷'}
              </div>
            )}
          </div>
          {/* Stats */}
          <div className="p-2">
            <div className="flex gap-2 text-xs text-gray-500 mb-1">
              <span>❤️ {m.like_count ?? 0}</span>
              <span>💬 {m.comments_count ?? 0}</span>
            </div>
            {m.caption && <p className="text-xs text-gray-700 line-clamp-2">{m.caption}</p>}
            <p className="text-xs text-gray-400 mt-1">{fmtDate(m.timestamp)}</p>
          </div>
          {/* Commentaires inline */}
          {m.comments?.length > 0 && (
            <div className="border-t px-2 py-1.5 space-y-1">
              {m.comments.slice(0, 3).map(c => (
                <p key={c.id} className="text-xs text-gray-600">
                  <span className="font-medium">@{c.username}</span> {c.text}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Commentaires ──────────────────────────────────────────────────────────────

function CommentairesTab({ commentaires }) {
  if (!commentaires.length) return <Empty msg="Aucun commentaire récent." />
  return (
    <div className="space-y-2 max-w-2xl">
      {commentaires.map(c => (
        <div key={c.id} className="flex gap-3 p-3 bg-white border rounded-lg">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm flex-shrink-0">
            {(c.username?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium">@{c.username}</span>
              <span className="text-xs text-gray-400">{fmtDate(c.timestamp)}</span>
              {c.mediaCaption && (
                <span className="text-xs text-gray-400 truncate">sur : {c.mediaCaption}…</span>
              )}
            </div>
            <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Messages ──────────────────────────────────────────────────────────────────

function MessagesTab({ conversations, privateDMs }) {
  const hasConv = conversations.length > 0
  const hasDMs  = privateDMs.length > 0

  if (!hasConv && !hasDMs) return (
    <div className="text-center py-12 text-gray-400 max-w-md mx-auto">
      <p className="text-3xl mb-2">✉️</p>
      <p className="text-sm mb-1">Aucune conversation récente</p>
      <p className="text-xs">
        Les DMs via API privée apparaîtront ici dès que le polling sera actif (Instagram → Paramètres).
      </p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── DMs via API privée ── */}
      {hasDMs && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Via API privée</span>
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" title="Compte IG_USERNAME" />
          </div>
          <div className="space-y-2">
            {privateDMs.map(dm => (
              <div key={dm.threadId} className="flex gap-3 p-3 bg-white border rounded-lg">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm flex-shrink-0">
                  {(dm.igAuteurNom?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {dm.igAuteurNom ? `@${dm.igAuteurNom}` : dm.igAuteurId}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDate(dm.timestamp)}</span>
                    {dm.isOwn && (
                      <span className="text-xs text-gray-400 italic">répondu</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-0.5">{dm.texte}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Conversations Meta API ── */}
      {hasConv && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Via Meta API</p>
          <div className="space-y-2">
            {conversations.map(conv => {
              const lastMsg = conv.messages?.data?.[0]
              const participants = conv.participants?.data ?? []
              const nom = participants[0]?.name ?? participants[0]?.username ?? 'Inconnu'
              return (
                <div key={conv.id} className="flex gap-3 p-3 bg-white border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                    {nom[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{nom}</span>
                      <span className="text-xs text-gray-400">{fmtDate(conv.updated_time)}</span>
                    </div>
                    {lastMsg && <p className="text-sm text-gray-600 truncate mt-0.5">{lastMsg.message}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatPill({ label, value }) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-800">{value ?? '—'}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

function Empty({ msg }) {
  return <p className="text-sm text-gray-400 text-center py-8">{msg}</p>
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtNum(n) {
  if (n == null) return '—'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
