import { useState, useEffect } from 'react'
import { site } from '../../../shared/api.js'

// ─── Constantes ───────────────────────────────────────────────────────────────

const IMPRESSION_OPTIONS = ['Noir & blanc', 'Couleurs']

const STATUS_LABEL = { publish: 'Publié', draft: 'Brouillon', pending: 'En attente', private: 'Privé' }
const STATUS_COLOR  = {
  publish: 'bg-green-100 text-green-700',
  draft:   'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  private: 'bg-purple-100 text-purple-700'
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function Site() {
  const [tab, setTab] = useState('ajouter')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Site ME — echodeplumes.com</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[['ajouter', 'Ajouter un produit'], ['produits', 'Produits publiés']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === val
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ajouter' ? <AjouterProduit /> : <ListeProduits />}
    </div>
  )
}

// ─── Onglet : Ajouter un produit ─────────────────────────────────────────────

function AjouterProduit() {
  const [etape, setEtape]     = useState('recherche') // 'recherche' | 'formulaire' | 'succes'
  const [urlAmazon, setUrlAmazon] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [bookData, setBookData] = useState(null)
  const [succes, setSucces]   = useState(null)

  // Données WC chargées une fois
  const [categories, setCategories] = useState([])
  const [wcProduits, setWcProduits] = useState([])

  // Formulaire
  const [form, setForm] = useState({
    title: '',
    authors: '',
    price: '',
    categoryId: '',
    impression: '',
    autoPublish: false,
    shortDescription: '',
    description: '',
    isbn: ''
  })
  const [upsellIds, setUpsellIds]         = useState([])   // IDs WC sélectionnés
  const [upsellCombo, setUpsellCombo]     = useState('')   // valeur du select combo
  const [generatingAccroche, setGeneratingAccroche] = useState(false)

  // Chargement catégories + produits WC au montage
  useEffect(() => {
    site.getCategories().then(setCategories).catch(() => {})
    site.getProduits({ limit: 100, status: 'any' }).then(setWcProduits).catch(() => {})
  }, [])

  // Pré-remplissage quand bookData arrive
  useEffect(() => {
    if (!bookData) return
    setForm({
      title:            bookData.title || '',
      authors:          (bookData.authors || []).map(a => a.name).join(', '),
      price:            bookData.priceAmount ? String(bookData.priceAmount) : '',
      categoryId:       '',
      impression:       '',
      autoPublish:      false,
      shortDescription: '',
      description:      bookData.description || '',
      isbn:             bookData.details?.isbn13 || bookData.details?.isbn10 || ''
    })
    setUpsellIds([])
    setEtape('formulaire')
  }, [bookData])

  async function handleScrape(e) {
    e.preventDefault()
    if (!urlAmazon.trim()) return
    setError(null)
    setLoading(true)
    try {
      const result = await site.scraperAmazon(urlAmazon.trim())
      setBookData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenererAccroche() {
    if (!form.description.trim()) return
    setGeneratingAccroche(true)
    try {
      const result = await site.genererAccroche(form.description)
      setForm(f => ({ ...f, shortDescription: result.accroche }))
    } catch (e) {
      setError(e.message)
    } finally {
      setGeneratingAccroche(false)
    }
  }

  function ajouterUpsell() {
    const id = parseInt(upsellCombo)
    if (!id || upsellIds.includes(id)) return
    setUpsellIds(ids => [...ids, id])
    setUpsellCombo('')
  }

  function retirerUpsell(id) {
    setUpsellIds(ids => ids.filter(i => i !== id))
  }

  async function handlePublier(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const updatedBook = {
        ...bookData,
        title:       form.title,
        authors:     form.authors.split(',').map(n => ({ name: n.trim(), role: 'Auteur' })).filter(a => a.name),
        description: form.description,
        details: {
          ...bookData.details,
          isbn13: form.isbn || bookData.details?.isbn13 || null
        }
      }
      const options = {
        price:            form.price,
        categoryIds:      form.categoryId ? [parseInt(form.categoryId)] : [],
        impression:       form.impression || null,
        autoPublish:      form.autoPublish,
        shortDescription: form.shortDescription,
        upsellIds
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
    setUrlAmazon('')
    setBookData(null)
    setSucces(null)
    setError(null)
    setUpsellIds([])
  }

  // ── Succès ──
  if (etape === 'succes' && succes) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center max-w-lg mx-auto">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">{succes.name}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Produit {succes.status === 'publish' ? 'publié' : 'créé en brouillon'} sur WooCommerce
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <a href={succes.editUrl} target="_blank" rel="noreferrer"
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
            Éditer sur WordPress
          </a>
          {succes.status === 'publish' && (
            <a href={succes.permalink} target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
              Voir sur le site
            </a>
          )}
          <button onClick={reset}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
            Ajouter un autre
          </button>
        </div>
      </div>
    )
  }

  // ── Formulaire ──
  if (etape === 'formulaire' && bookData) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={reset} className="text-sm text-indigo-600 hover:underline">← Nouvelle recherche</button>
        </div>

        <form onSubmit={handlePublier} className="space-y-5">

          {/* Couverture + champs principaux */}
          <div className="bg-white rounded-lg shadow p-5 flex gap-5">
            {bookData.coverImage && (
              <div className="flex-shrink-0 space-y-2">
                <img src={bookData.coverImage} alt="Couverture"
                  className="w-24 h-32 object-cover rounded shadow" />
                {bookData.backCoverImage && (
                  <img src={bookData.backCoverImage} alt="Verso"
                    className="w-24 h-32 object-cover rounded shadow" />
                )}
              </div>
            )}
            <div className="flex-1 space-y-3">
              <Field label="Titre">
                <input type="text" value={form.title} required
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Auteurs (séparés par virgule)">
                <input type="text" value={form.authors}
                  onChange={e => setForm(f => ({ ...f, authors: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="ISBN">
                <input type="text" value={form.isbn}
                  onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))}
                  className={inputCls} placeholder="978-..." />
              </Field>
            </div>
          </div>

          {/* Détails techniques */}
          {(bookData.details?.pages || bookData.details?.publisher) && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex flex-wrap gap-4 text-xs text-gray-600">
              {bookData.details.pages     && <span><span className="font-medium">Pages :</span> {bookData.details.pages}</span>}
              {bookData.details.publisher && <span><span className="font-medium">Éditeur :</span> {bookData.details.publisher}</span>}
              {bookData.details.publicationDate && <span><span className="font-medium">Parution :</span> {bookData.details.publicationDate}</span>}
            </div>
          )}

          {/* Options publication */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Options de publication</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prix (€)">
                <input type="number" step="0.01" min="0" value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="Ex : 14.90" className={inputCls} />
              </Field>
              <Field label="Catégorie WooCommerce">
                <select value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  className={inputCls}>
                  <option value="">— Non précisé —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Impression des pages intérieures">
                <select value={form.impression}
                  onChange={e => setForm(f => ({ ...f, impression: e.target.value }))}
                  className={inputCls}>
                  <option value="">— Non précisé —</option>
                  {IMPRESSION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.autoPublish}
                    onChange={e => setForm(f => ({ ...f, autoPublish: e.target.checked }))}
                    className="w-4 h-4 rounded accent-indigo-600" />
                  <span className="text-sm text-gray-700">Publier directement</span>
                </label>
              </div>
            </div>
          </div>

          {/* Produits suggérés */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Produits suggérés</h3>
            <div className="flex gap-2 mb-3">
              <select value={upsellCombo} onChange={e => setUpsellCombo(e.target.value)}
                className={`${inputCls} flex-1`}>
                <option value="">— Choisir un produit —</option>
                {wcProduits
                  .filter(p => !upsellIds.includes(p.id))
                  .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                }
              </select>
              <button type="button" onClick={ajouterUpsell}
                disabled={!upsellCombo}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-40">
                Ajouter
              </button>
            </div>
            {upsellIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {upsellIds.map(id => {
                  const p = wcProduits.find(p => p.id === id)
                  return (
                    <span key={id}
                      className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2 py-1 rounded">
                      {p?.name || `#${id}`}
                      <button type="button" onClick={() => retirerUpsell(id)}
                        className="ml-1 text-indigo-400 hover:text-indigo-700 font-bold">×</button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Accroche */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                Accroche courte
              </label>
              <button type="button" onClick={handleGenererAccroche}
                disabled={generatingAccroche || !form.description.trim()}
                className="px-3 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40">
                {generatingAccroche ? 'Génération…' : '✦ Générer avec Gemini'}
              </button>
            </div>
            <textarea value={form.shortDescription}
              onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))}
              rows={3}
              placeholder="Cliquez sur « Générer avec Gemini » ou saisissez manuellement…"
              className={`${inputCls} resize-y`} />
          </div>

          {/* Description complète */}
          <div className="bg-white rounded-lg shadow p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description complète</label>
            <textarea value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={6}
              className={`${inputCls} resize-y`} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={reset}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading
                ? 'Publication en cours…'
                : form.autoPublish ? 'Publier sur le site' : 'Créer en brouillon'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── Recherche ──
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Ajouter un livre depuis Amazon KDP</h2>
        <form onSubmit={handleScrape} className="space-y-4">
          <Field label="URL de la page Amazon du livre">
            <input type="url" value={urlAmazon}
              onChange={e => setUrlAmazon(e.target.value)}
              placeholder="https://www.amazon.fr/dp/..."
              className={inputCls} autoFocus />
            <p className="text-xs text-gray-400 mt-1">
              Colle l'URL de la fiche Amazon — couverture HD, auteurs, prix, description et détails seront récupérés automatiquement (~30s).
            </p>
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" disabled={loading || !urlAmazon.trim()}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Scraping Amazon en cours…' : 'Récupérer les informations →'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Onglet : Liste des produits ─────────────────────────────────────────────

function ListeProduits() {
  const [produits, setProduits] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [filtre, setFiltre]     = useState('any')

  useEffect(() => { charger() }, [filtre])

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
      <div className="flex gap-2 mb-4">
        {[['any', 'Tous'], ['publish', 'Publiés'], ['draft', 'Brouillons']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltre(val)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filtre === val ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {label}
          </button>
        ))}
        <button onClick={charger}
          className="ml-auto px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.image
                        ? <img src={p.image} alt={p.name} className="w-8 h-10 object-cover rounded flex-shrink-0" />
                        : <div className="w-8 h-10 bg-gray-100 rounded flex-shrink-0" />
                      }
                      <span className="font-medium text-gray-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.price ? `${p.price} €` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a href={p.editUrl} target="_blank" rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline">Éditer</a>
                      {p.status === 'publish' && (
                        <a href={p.permalink} target="_blank" rel="noreferrer"
                          className="text-xs text-green-600 hover:underline">Voir</a>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
