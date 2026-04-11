import { useState, useEffect } from 'react'
import { instagram } from '../../shared/api.js'
import { IG_FORMATS } from './igFormats.js'

const STATUT_LABEL = {
  brouillon: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-600' },
  programme: { label: 'Programmé', cls: 'bg-blue-100 text-blue-700' },
  publie:    { label: 'Publié',    cls: 'bg-green-100 text-green-700' },
  erreur:    { label: 'Erreur',    cls: 'bg-red-100 text-red-600' },
}

export default function IgPostsLibrary({ onLoad, onLoadGabarit, onClose }) {
  const [tab, setTab]         = useState('brouillons')  // 'brouillons' | 'templates'
  const [posts, setPosts]     = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  async function load() {
    setLoading(true)
    const [allPosts, allTemplates] = await Promise.all([
      instagram.getPosts().catch(() => []),
      instagram.getTemplates().catch(() => []),
    ])
    setPosts(allPosts.filter(p => !p.estTemplate))
    setTemplates(allTemplates)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function supprimer(id) {
    if (!window.confirm('Supprimer ?')) return
    setDeleting(id)
    await instagram.deletePost(id).catch(() => {})
    await load()
    setDeleting(null)
  }

  async function deprogrammer(id) {
    await instagram.deprogrammerPost(id).catch(() => {})
    load()
  }

  async function toggleTemplate(post) {
    await instagram.updatePost(post.id, { estTemplate: !post.estTemplate })
    load()
  }

  const liste = tab === 'templates' ? templates : posts

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Bibliothèque Instagram</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Onglets */}
        <div className="flex border-b px-4 gap-1 pt-1">
          {[
            { id: 'brouillons', label: `Brouillons (${posts.length})` },
            { id: 'templates',  label: `Templates (${templates.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t ${
                tab === t.id ? 'text-pink-600 border-b-2 border-pink-500' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Info templates */}
        {tab === 'templates' && (
          <div className="px-5 py-2 bg-purple-50 border-b text-xs text-purple-700">
            Les templates sont des vignettes réutilisables. EVA les utilise pour générer automatiquement des posts dans le Calendrier.
          </div>
        )}

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
          ) : liste.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">{tab === 'templates' ? '📐' : '📭'}</p>
              {tab === 'templates' ? (
                <>
                  <p className="text-sm">Aucun template</p>
                  <p className="text-xs mt-1">Ouvrez un brouillon et cliquez sur "📐 En template" pour le convertir.</p>
                </>
              ) : (
                <>
                  <p className="text-sm">Aucun brouillon</p>
                  <p className="text-xs mt-1">Créez un post et cliquez sur "Sauv." pour le retrouver ici.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {liste.map(post => {
                const fmt    = IG_FORMATS[post.format] ?? IG_FORMATS.portrait
                const statut = STATUT_LABEL[post.statut] ?? STATUT_LABEL.brouillon
                let nb = 0
                try { nb = JSON.parse(post.vignettes).length } catch {}
                return (
                  <div key={post.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    {/* Miniature placeholder */}
                    <div className={`w-12 h-12 rounded border flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                      post.estTemplate ? 'bg-purple-50 border-purple-200 text-purple-500' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {nb}v
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {post.titre || `Post #${post.id}`}
                        </p>
                        {!post.estTemplate && (
                          <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${statut.cls}`}>
                            {statut.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{fmt.label}</span>
                      </div>
                      {post.sujet && (
                        <p className="text-xs text-purple-600 mt-0.5 truncate">✦ {post.sujet}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {post.legende?.slice(0, 60) || '(sans légende)'}
                        {post.legende?.length > 60 ? '…' : ''}
                      </p>
                      <p className="text-xs text-gray-400">
                        Modifié : {new Date(post.updatedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <div className="flex gap-1">
                        <button
                          onClick={() => onLoad(post)}
                          className="px-2 py-1 text-xs bg-pink-500 text-white rounded hover:bg-pink-600"
                        >
                          Ouvrir
                        </button>
                        {!post.estTemplate && post.statut === 'programme' && (
                          <button onClick={() => deprogrammer(post.id)}
                            className="px-2 py-1 text-xs border border-blue-300 text-blue-600 rounded hover:bg-blue-50">
                            Déprog.
                          </button>
                        )}
                        <button
                          onClick={() => supprimer(post.id)}
                          disabled={deleting === post.id}
                          className="px-2 py-1 text-xs border border-red-200 text-red-400 rounded hover:bg-red-50 disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => onLoadGabarit(post)}
                          className="px-2 py-1 text-xs border border-purple-200 text-purple-600 rounded hover:bg-purple-50 flex-1"
                          title="Injecte la 1ère vignette comme gabarit dans la vignette courante"
                        >
                          📐 Gabarit
                        </button>
                        <button
                          onClick={() => toggleTemplate(post)}
                          className={`px-2 py-1 text-xs border rounded flex-1 ${
                            post.estTemplate
                              ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                              : 'border-purple-200 text-purple-600 hover:bg-purple-50'
                          }`}
                          title={post.estTemplate ? 'Retirer des templates' : 'Marquer comme template'}
                        >
                          {post.estTemplate ? '↩ Brouillon' : '📐 Template'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-between items-center">
          <p className="text-xs text-gray-400">{liste.length} élément{liste.length > 1 ? 's' : ''}</p>
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
