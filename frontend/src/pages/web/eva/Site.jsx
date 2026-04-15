import { useState, useEffect } from 'react'
import { site } from '../../../shared/api.js'

// ─── Constantes ───────────────────────────────────────────────────────────────

const GENRES = [
  'Roman', 'Nouvelle', 'Poésie', 'Jeunesse', 'Adolescent',
  'Essai', 'Fantastique', 'Science-Fiction', 'Romance', 'Goodie', 'Autres'
]

const GENRE_KEY_MAP = {
  'Roman': 'roman', 'Nouvelle': 'nouvelle', 'Poésie': 'poésie',
  'Jeunesse': 'jeunesse', 'Adolescent': 'adolescent', 'Essai': 'essai',
  'Fantastique': 'fantastique', 'Science-Fiction': 'science-fiction',
  'Romance': 'romance', 'Goodie': 'goodie', 'Autres': ''
}

const STATUS_LABEL = { publish: 'Publié', draft: 'Brouillon', pending: 'En attente', private: 'Privé' }
const STATUS_COLOR = {
  publish: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  private: 'bg-purple-100 text-purple-700'
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function Site() {
  const [tab, setTab] = useState('ajouter') // 'ajouter' | 'produits'

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Site ME — echodeplumes.com</h1>

      {/* Onglets */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('ajouter')}
          className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === 'ajouter'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Ajouter un produit
        </button>
        <button
          onClick={() => setTab('produits')}
          className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === 'produits'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Produits publiés
        </button>
      </div>

      {tab === 'ajouter' ? <AjouterProduit /> : <ListeProduits />}
    </div>
  )
}

// ─── Onglet : Ajouter un produit ─────────────────────────────────────────────

function AjouterProduit() {
  // Étape : 'recherche' | 'choix' | 'formulaire' | 'succes'
  const [etape, setEtape] = useState('recherche')
  const [mode, setMode] = useState('isbn') // 'isbn' | 'amazon'
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultats, setResultats] = useState([]) // liste Google Books (mode titre)
  const [bookData, setBookData] = useState(null)  // données pré-remplies
  const [succes, setSucces] = useState(null)

  // Formulaire options
  const [form, setForm] = useState({
    title: '',
    authors: '',
    price: '',
    stock: '0',
    genre: '',
    autoPublish: false,
    shortDescription: '',
    description: ''
  })

  // Quand on a des bookData, on pré-remplit le formulaire
  useEffect(() => {
    if (!bookData) return
    setForm({
      title: bookData.title || '',
      authors: (bookData.authors || []).map(a => a.name).join(', '),
      price: bookData.priceAmount ? String(bookData.priceAmount) : '',
      stock: '0',
      genre: '',
      autoPublish: false,
      shortDescription: '',
      description: bookData.description || ''
    })
    setEtape('formulaire')
  }, [bookData])

  async function handleRecherche(e) {
    e.preventDefault()
    if (!query.trim()) return
    setError(null)
    setLoading(true)
    try {
      if (mode === 'isbn') {
        const result = await site.rechercherISBN(query.trim())
        // Si tableau → plusieurs résultats (recherche titre)
        if (Array.isArray(result)) {
          setResultats(result)
          setEtape('choix')
        } else {
          setBookData(result)
        }
      } else {
        const result = await site.scraperAmazon(query.trim())
        setBookData(result)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePublier(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Reconstruit bookData avec les valeurs modifiées du formulaire
      const updatedBook = {
        ...bookData,
        title: form.title,
        authors: form.authors.split(',').map(n => ({ name: n.trim(), role: 'Auteur' })).filter(a => a.name),
        description: form.description
      }
      const options = {
        price: form.price,
        stock: parseInt(form.stock) || 0,
        genre: GENRE_KEY_MAP[form.genre] || '',
        autoPublish: form.autoPublish,
        shortDescription: form.shortDescription || null
      }
      const result = await site.publierProduit(updatedBook, options)
      setSucces(result)
      setEtape('succes')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setEtape('recherche')
    setQuery('')
    setBookData(null)
    setResultats([])
    setSucces(null)
    setError(null)
  }

  // ── Étape : Succès ──
  if (etape === 'succes' && succes) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center max-w-lg mx-auto">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">{succes.name}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Produit {succes.status === 'publish' ? 'publié' : 'créé en brouillon'} sur WooCommerce
        </p>
        <div className="flex justify-center gap-3">
          <a
            href={succes.editUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            Éditer sur WordPress
          </a>
          {succes.status === 'publish' && (
            <a
              href={succes.permalink}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Voir sur le site
            </a>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
          >
            Ajouter un autre
          </button>
        </div>
      </div>
    )
  }

  // ── Étape : Choix parmi plusieurs résultats Google Books ──
  if (etape === 'choix') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setEtape('recherche')} className="text-sm text-indigo-600 hover:underline">← Retour</button>
          <h2 className="text-sm font-medium text-gray-700">{resultats.length} résultats pour « {query} »</h2>
        </div>
        <div className="space-y-3">
          {resultats.map((r, i) => (
            <button
              key={i}
              onClick={() => setBookData(r)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-sm transition flex gap-4"
            >
              {r.coverImage && (
                <img src={r.coverImage} alt={r.title} className="w-12 h-16 object-cover rounded flex-shrink-0" />
              )}
              <div>
                <p className="font-medium text-gray-800 text-sm">{r.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.authors.map(a => a.name).join(', ')}</p>
                {r.details.isbn13 && <p className="text-xs text-gray-400 mt-0.5">ISBN {r.details.isbn13}</p>}
                {r.details.publicationDate && <p className="text-xs text-gray-400">{r.details.publicationDate}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Étape : Formulaire ──
  if (etape === 'formulaire' && bookData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={reset} className="text-sm text-indigo-600 hover:underline">← Nouvelle recherche</button>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            Source : {bookData.source === 'amazon' ? 'Amazon' : 'Google Books'}
          </span>
        </div>

        <form onSubmit={handlePublier} className="space-y-5">
          {/* Aperçu couverture + champs principaux */}
          <div className="bg-white rounded-lg shadow p-5 flex gap-5">
            {bookData.coverImage && (
              <div className="flex-shrink-0">
                <img
                  src={bookData.coverImage}
                  alt="Couverture"
                  className="w-24 h-32 object-cover rounded shadow"
                />
                {bookData.backCoverImage && (
                  <img
                    src={bookData.backCoverImage}
                    alt="Verso"
                    className="w-24 h-32 object-cover rounded shadow mt-2"
                  />
                )}
              </div>
            )}

            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Titre</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Auteurs (séparés par virgule)</label>
                <input
                  type="text"
                  value={form.authors}
                  onChange={e => setForm(f => ({ ...f, authors: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
          </div>

          {/* Détails techniques */}
          {(bookData.details?.isbn13 || bookData.details?.pages || bookData.details?.publisher) && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex flex-wrap gap-4 text-xs text-gray-600">
              {bookData.details.isbn13 && <span><span className="font-medium">ISBN-13 :</span> {bookData.details.isbn13}</span>}
              {bookData.details.isbn10 && <span><span className="font-medium">ISBN-10 :</span> {bookData.details.isbn10}</span>}
              {bookData.details.pages && <span><span className="font-medium">Pages :</span> {bookData.details.pages}</span>}
              {bookData.details.publisher && <span><span className="font-medium">Éditeur :</span> {bookData.details.publisher}</span>}
              {bookData.details.publicationDate && <span><span className="font-medium">Parution :</span> {bookData.details.publicationDate}</span>}
            </div>
          )}

          {/* Options publication */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Options de publication</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prix (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="Ex : 14.90"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stock initial</label>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Genre / Catégorie WooCommerce</label>
                <select
                  value={form.genre}
                  onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">— Non précisé —</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoPublish}
                    onChange={e => setForm(f => ({ ...f, autoPublish: e.target.checked }))}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">Publier directement</span>
                </label>
              </div>
            </div>
          </div>

          {/* Description courte (accroche) */}
          <div className="bg-white rounded-lg shadow p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Accroche courte
              <span className="ml-2 text-xs font-normal text-gray-400">(laissez vide → générée par Gemini)</span>
            </label>
            <textarea
              value={form.shortDescription}
              onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))}
              rows={3}
              placeholder="Laissez vide pour que Gemini génère une accroche commerciale automatiquement…"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
            />
          </div>

          {/* Description complète */}
          <div className="bg-white rounded-lg shadow p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description complète</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={6}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Publication en cours…'
                : form.autoPublish
                  ? 'Publier sur le site'
                  : 'Créer en brouillon'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── Étape : Recherche ──
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Ajouter un livre depuis KDP</h2>

        {/* Sélecteur de mode */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
          <button
            onClick={() => setMode('isbn')}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-medium ${
              mode === 'isbn' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ISBN ou titre
          </button>
          <button
            onClick={() => setMode('amazon')}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-medium ${
              mode === 'amazon' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            URL Amazon
          </button>
        </div>

        <form onSubmit={handleRecherche} className="space-y-4">
          <div>
            {mode === 'isbn' ? (
              <>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  ISBN (10 ou 13 chiffres) ou titre du livre
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Ex : 9782496018546 ou Le Nom du Vent"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Recommandé — rapide, fiable, ne nécessite pas Chromium.
                </p>
              </>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  URL de la page Amazon du livre
                </label>
                <input
                  type="url"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="https://www.amazon.fr/dp/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Récupère la couverture HD + verso. Nécessite Puppeteer (~30s).
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? mode === 'isbn' ? 'Recherche en cours…' : 'Scraping Amazon…'
              : 'Récupérer les informations →'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Onglet : Liste des produits ─────────────────────────────────────────────

function ListeProduits() {
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtre, setFiltre] = useState('any')

  useEffect(() => {
    charger()
  }, [filtre])

  async function charger() {
    setLoading(true)
    setError(null)
    try {
      const data = await site.getProduits({ limit: 50, status: filtre })
      setProduits(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Filtres */}
      <div className="flex gap-2 mb-4">
        {[['any', 'Tous'], ['publish', 'Publiés'], ['draft', 'Brouillons']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltre(val)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filtre === val ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={charger}
          className="ml-auto px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          Actualiser
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Chargement…</div>
      ) : produits.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Aucun produit.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Produit</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Prix</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {produits.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 flex items-center gap-3">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="w-8 h-10 object-cover rounded flex-shrink-0" />
                      : <div className="w-8 h-10 bg-gray-100 rounded flex-shrink-0" />
                    }
                    <span className="font-medium text-gray-800">{p.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.price ? `${p.price} €` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={p.editUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Éditer
                      </a>
                      {p.status === 'publish' && (
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-green-600 hover:underline"
                        >
                          Voir
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
