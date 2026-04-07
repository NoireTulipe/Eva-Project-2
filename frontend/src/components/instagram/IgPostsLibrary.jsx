import { useState, useEffect } from 'react'
import { instagram } from '../../shared/api.js'
import { IG_FORMATS } from './igFormats.js'

const STATUT_LABEL = {
  brouillon:  { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600' },
  programme:  { label: 'Programmé',  cls: 'bg-blue-100 text-blue-700' },
  publie:     { label: 'Publié',     cls: 'bg-green-100 text-green-700' },
  erreur:     { label: 'Erreur',     cls: 'bg-red-100 text-red-600' },
}

export default function IgPostsLibrary({ onLoad, onClose }) {
  const [posts, setPosts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  async function load() {
    setLoading(true)
    setPosts(await instagram.getPosts().catch(() => []))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function supprimer(id) {
    if (!window.confirm('Supprimer ce post ?')) return
    setDeleting(id)
    await instagram.deletePost(id).catch(() => {})
    await load()
    setDeleting(null)
  }

  async function deprogrammer(id) {
    await instagram.deprogrammerPost(id).catch(() => {})
    load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Mes posts Instagram</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">Aucun post sauvegardé</p>
              <p className="text-xs mt-1">Créez un post et cliquez sur "Sauv." pour le retrouver ici.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map(post => {
                const fmt = IG_FORMATS[post.format] ?? IG_FORMATS.portrait
                const statut = STATUT_LABEL[post.statut] ?? STATUT_LABEL.brouillon
                let nb = 0
                try { nb = JSON.parse(post.vignettes).length } catch {}
                return (
                  <div key={post.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    {/* Miniature placeholder */}
                    <div className="w-12 h-12 rounded border bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs font-medium">
                      {nb}v
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {post.titre || `Post #${post.id}`}
                        </p>
                        <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${statut.cls}`}>
                          {statut.label}
                        </span>
                        <span className="text-xs text-gray-400">{fmt.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {post.legende?.slice(0, 60) || '(sans légende)'}
                        {post.legende?.length > 60 ? '…' : ''}
                      </p>
                      <p className="text-xs text-gray-400">
                        {post.statut === 'programme' && post.scheduledAt
                          ? `Programmé : ${new Date(post.scheduledAt).toLocaleString('fr-FR')}`
                          : `Modifié : ${new Date(post.updatedAt).toLocaleDateString('fr-FR')}`
                        }
                      </p>
                      {post.erreurPubli && (
                        <p className="text-xs text-red-500 mt-0.5">⚠ {post.erreurPubli}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      {(post.statut === 'brouillon' || post.statut === 'erreur') && (
                        <button
                          onClick={() => onLoad(post)}
                          className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600"
                        >
                          Ouvrir
                        </button>
                      )}
                      {post.statut === 'programme' && (
                        <button
                          onClick={() => deprogrammer(post.id)}
                          className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded hover:bg-blue-50"
                        >
                          Déprogrammer
                        </button>
                      )}
                      <button
                        onClick={() => supprimer(post.id)}
                        disabled={deleting === post.id}
                        className="px-2 py-1.5 text-sm border border-red-200 text-red-400 rounded hover:bg-red-50 disabled:opacity-40"
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

        <div className="px-5 py-3 border-t flex justify-between items-center">
          <p className="text-xs text-gray-400">{posts.length} post{posts.length > 1 ? 's' : ''}</p>
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
