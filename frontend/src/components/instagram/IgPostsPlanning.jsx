import { useState, useEffect } from 'react'
import { instagram } from '../../shared/api.js'
import { IG_FORMATS } from './igFormats.js'

const STATUT_LABEL = {
  brouillon: { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600' },
  programme: { label: 'Programmé',  cls: 'bg-blue-100 text-blue-700' },
  publie:    { label: 'Publié',     cls: 'bg-green-100 text-green-700' },
  erreur:    { label: 'Erreur',     cls: 'bg-red-100 text-red-600' },
}

export default function IgPostsPlanning() {
  const [posts, setPosts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filtre, setFiltre]     = useState('tous') // 'tous' | 'programme' | 'publie' | 'brouillon' | 'erreur'

  async function load() {
    setLoading(true)
    setPosts(await instagram.getPosts().catch(() => []))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function deprogrammer(id) {
    await instagram.deprogrammerPost(id)
    load()
  }

  async function supprimer(id) {
    if (!window.confirm('Supprimer ce post ?')) return
    await instagram.deletePost(id)
    load()
  }

  const affichés = filtre === 'tous' ? posts : posts.filter(p => p.statut === filtre)
  const nbProg = posts.filter(p => p.statut === 'programme').length

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">Planning des publications</h2>
          {nbProg > 0 && (
            <p className="text-sm text-blue-600">{nbProg} post{nbProg > 1 ? 's' : ''} programmé{nbProg > 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {['tous', 'programme', 'publie', 'brouillon', 'erreur'].map(f => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filtre === f ? 'bg-pink-500 text-white border-pink-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {f === 'tous' ? 'Tous' : STATUT_LABEL[f]?.label}
              {f !== 'tous' && (
                <span className="ml-1 opacity-70">({posts.filter(p => p.statut === f).length})</span>
              )}
            </button>
          ))}
          <button onClick={load} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 ml-2">↻</button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
      ) : affichés.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm">Aucun post {filtre !== 'tous' ? `(${STATUT_LABEL[filtre]?.label})` : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {affichés
            .sort((a, b) => {
              // Posts programmés en premier, triés par date
              if (a.statut === 'programme' && b.statut !== 'programme') return -1
              if (b.statut === 'programme' && a.statut !== 'programme') return 1
              const da = a.scheduledAt ?? a.updatedAt
              const db = b.scheduledAt ?? b.updatedAt
              return new Date(da) - new Date(db)
            })
            .map(post => {
              const fmt    = IG_FORMATS[post.format] ?? IG_FORMATS.portrait
              const statut = STATUT_LABEL[post.statut] ?? STATUT_LABEL.brouillon
              let nb = 0
              try { nb = JSON.parse(post.vignettes).length } catch {}

              return (
                <div key={post.id} className="flex items-start gap-4 p-4 border rounded-lg bg-white shadow-sm">
                  {/* Indicateur statut */}
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                    post.statut === 'programme' ? 'bg-blue-400' :
                    post.statut === 'publie'    ? 'bg-green-400' :
                    post.statut === 'erreur'    ? 'bg-red-400' : 'bg-gray-300'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-medium">{post.titre || `Post #${post.id}`}</p>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statut.cls}`}>
                        {statut.label}
                      </span>
                      <span className="text-xs text-gray-400">{fmt.label} — {nb} vignette{nb > 1 ? 's' : ''}</span>
                    </div>

                    {/* Date programmée */}
                    {post.statut === 'programme' && post.scheduledAt && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs text-blue-600 font-medium">
                          🕐 {new Date(post.scheduledAt).toLocaleDateString('fr-FR', {
                            weekday: 'long', day: 'numeric', month: 'long',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({tempsRestant(post.scheduledAt)})
                        </span>
                      </div>
                    )}

                    {post.statut === 'publie' && post.publishedAt && (
                      <p className="text-xs text-green-600 mb-1">
                        ✓ Publié le {new Date(post.publishedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    )}

                    {post.erreurPubli && (
                      <p className="text-xs text-red-500 mb-1">⚠ {post.erreurPubli}</p>
                    )}

                    {post.legende && (
                      <p className="text-xs text-gray-500 truncate">{post.legende}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    {post.statut === 'programme' && (
                      <button
                        onClick={() => deprogrammer(post.id)}
                        className="px-2 py-1 text-xs border border-blue-200 text-blue-600 rounded hover:bg-blue-50"
                        title="Remettre en brouillon"
                      >
                        Déprogrammer
                      </button>
                    )}
                    <button
                      onClick={() => supprimer(post.id)}
                      className="px-2 py-1 text-xs border border-red-200 text-red-400 rounded hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

function tempsRestant(iso) {
  const diff = new Date(iso) - new Date()
  if (diff < 0) return 'en attente de publication…'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `dans ${Math.floor(h / 24)}j`
  if (h > 0)  return `dans ${h}h${m > 0 ? m + 'min' : ''}`
  return `dans ${m}min`
}
