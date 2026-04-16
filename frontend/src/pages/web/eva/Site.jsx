import { useState, useEffect, useRef } from 'react'
import { site } from '../../../shared/api.js'

// ─── Constantes ───────────────────────────────────────────────────────────────

const IMPRESSION_OPTIONS = ['Noir & blanc', 'Couleurs']

const METHOD_LABELS = {
  flat_rate:     'Tarif fixe',
  free_shipping: 'Livraison gratuite',
  local_pickup:  'Retrait en magasin'
}

const REQUIRES_OPTIONS = [
  ['',           'Toujours disponible'],
  ['min_amount', 'Montant minimum (€)'],
  ['coupon',     'Coupon valide'],
  ['either',     'Coupon OU montant min'],
  ['both',       'Coupon ET montant min'],
]

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
        {[['ajouter', 'Ajouter un produit'], ['produits', 'Produits publiés'], ['articles', 'News / Articles'], ['livraison', 'Livraison']].map(([val, label]) => (
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

      {tab === 'ajouter'   && <AjouterProduit />}
      {tab === 'produits'  && <ListeProduits />}
      {tab === 'articles'  && <NouvelArticle />}
      {tab === 'livraison' && <Livraison />}
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

  // Images supplémentaires
  const [extraImages, setExtraImages]     = useState([])   // [{ id, src, name }]
  const [uploadingImg, setUploadingImg]   = useState(false)
  const fileInputRef                      = useRef(null)

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
    setExtraImages([])
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

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploadingImg(true)
    setError(null)

    // Pré-aperçu local immédiat (objectURL) avant même l'upload
    const previews = files.map(file => ({
      id: null,
      src: URL.createObjectURL(file),
      name: file.name,
      pending: true
    }))
    setExtraImages(imgs => [...imgs, ...previews])

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const media = await site.uploadMedia(file, {
          altText: `Image de ${form.title || bookData?.title || ''}`,
          title:   form.title || bookData?.title || file.name
        })
        // Remplace le preview local par l'URL WP définitive
        setExtraImages(imgs => imgs.map(img =>
          img.name === file.name && img.pending
            ? { id: media.id, src: media.src, name: file.name, pending: false }
            : img
        ))
      }
    } catch (e) {
      // Retire les previews pending en cas d'erreur
      setExtraImages(imgs => imgs.filter(img => !img.pending))
      setError(e.message)
    } finally {
      setUploadingImg(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function retirerExtraImage(id) {
    setExtraImages(imgs => {
      const img = imgs.find(i => i.id === id)
      if (img?.src?.startsWith('blob:')) URL.revokeObjectURL(img.src)
      return imgs.filter(i => i.id !== id)
    })
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
        upsellIds,
        extraImageIds: extraImages.map(i => i.id)
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
    setExtraImages([])
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

          {/* Images supplémentaires */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Images supplémentaires</h3>
            <p className="text-xs text-gray-400 mb-3">
              Uploadées immédiatement dans la médiathèque WordPress et ajoutées au produit.
            </p>

            {/* Aperçus */}
            {extraImages.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {extraImages.map((img, idx) => (
                  <div key={img.id ?? `pending-${idx}`} className="relative group flex flex-col items-center gap-1">
                    <div className="relative">
                      <img src={img.src} alt={img.name}
                        className={`w-20 h-24 object-cover rounded shadow border ${img.pending ? 'border-yellow-300 opacity-60' : 'border-green-300'}`} />
                      {img.pending && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded">
                          <span className="text-xs text-yellow-600 font-medium">Upload…</span>
                        </div>
                      )}
                      {!img.pending && (
                        <button
                          type="button"
                          onClick={() => retirerExtraImage(img.id)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >×</button>
                      )}
                    </div>
                    <span className={`text-xs ${img.pending ? 'text-yellow-500' : 'text-green-600'}`}>
                      {img.pending ? '…' : '✓'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="extra-images-input"
              />
              <label
                htmlFor="extra-images-input"
                className={`px-4 py-2 border border-dashed border-gray-300 rounded text-sm text-gray-600 cursor-pointer hover:border-indigo-400 hover:text-indigo-600 transition-colors ${uploadingImg ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploadingImg ? 'Upload en cours…' : '+ Ajouter des images'}
              </label>
              {extraImages.length > 0 && (
                <span className="text-xs text-gray-400">{extraImages.length} image{extraImages.length > 1 ? 's' : ''} ajoutée{extraImages.length > 1 ? 's' : ''}</span>
              )}
            </div>
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

// ─── Onglet : News / Articles ────────────────────────────────────────────────

function NouvelArticle() {
  const [generalPrompt, setGeneralPrompt]   = useState('')
  const [promptEditing, setPromptEditing]   = useState(false)
  const [promptSaving, setPromptSaving]     = useState(false)
  const [instruction, setInstruction]       = useState('')
  const [generating, setGenerating]         = useState(false)
  const [publishing, setPublishing]         = useState(false)
  const [error, setError]                   = useState(null)
  const [succes, setSucces]                 = useState(null)

  // Résultat généré
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')

  // Options publication
  const [date, setDate]           = useState(todayISO())
  const [autoPublish, setAutoPublish] = useState(false)

  // Image à la une
  const [featuredImage, setFeaturedImage]   = useState(null)  // { id, src, pending }
  const [uploadingFeatured, setUploadingFeatured] = useState(false)
  const featuredInputRef = useRef(null)

  // Chargement du prompt général au montage
  useEffect(() => {
    site.getNewsPrompt()
      .then(data => setGeneralPrompt(data.prompt))
      .catch(() => {})
  }, [])

  async function handleSavePrompt() {
    setPromptSaving(true)
    try {
      await site.saveNewsPrompt(generalPrompt)
      setPromptEditing(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setPromptSaving(false)
    }
  }

  async function handleGenerer() {
    if (!instruction.trim()) return
    setError(null)
    setGenerating(true)
    setTitle('')
    setContent('')
    try {
      const result = await site.genererArticle(generalPrompt, instruction)
      setTitle(result.title)
      setContent(result.content)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleFeaturedUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploadingFeatured(true)
    // Aperçu local immédiat
    const preview = URL.createObjectURL(file)
    setFeaturedImage({ id: null, src: preview, pending: true })
    try {
      const articleTitle = title || instruction.split('\n')[0] || 'article'
      const media = await site.uploadMedia(file, {
        altText:     `Image d'illustration pour l'article : ${articleTitle}`,
        title:       articleTitle,
        caption:     `Illustration de l'article « ${articleTitle} » — Éditions Écho de Plumes`,
        description: `Image d'illustration pour l'article : ${articleTitle}`
      })
      URL.revokeObjectURL(preview)
      setFeaturedImage({ id: media.id, src: media.src, pending: false })
    } catch (e) {
      setFeaturedImage(null)
      setError(e.message)
    } finally {
      setUploadingFeatured(false)
      if (featuredInputRef.current) featuredInputRef.current.value = ''
    }
  }

  async function handlePublier(status) {
    if (!title.trim() || !content.trim()) return
    setError(null)
    setPublishing(true)
    try {
      const isoDate = date ? (date.includes('T') ? date : `${date}T08:00:00`) : undefined
      const result = await site.publierArticle({
        title,
        content,
        date: isoDate,
        status,
        featuredMediaId: featuredImage?.id || null
      })
      setSucces(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setPublishing(false)
    }
  }

  function reset() {
    setTitle('')
    setContent('')
    setInstruction('')
    setSucces(null)
    setError(null)
    setDate(todayISO())
    setAutoPublish(false)
    setFeaturedImage(null)
  }

  // ── Succès ──
  if (succes) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center max-w-lg mx-auto">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">{succes.title}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Article {succes.status === 'publish' ? 'publié' : 'créé en brouillon'}
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <a href={succes.editUrl} target="_blank" rel="noreferrer"
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
            Éditer sur WordPress
          </a>
          {succes.status === 'publish' && (
            <a href={succes.link} target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
              Voir sur le site
            </a>
          )}
          <button onClick={reset}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
            Nouvel article
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Prompt général */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Prompt général</h3>
          {!promptEditing ? (
            <button onClick={() => setPromptEditing(true)}
              className="text-xs text-indigo-600 hover:underline">Modifier</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setPromptEditing(false)}
                className="text-xs text-gray-500 hover:underline">Annuler</button>
              <button onClick={handleSavePrompt} disabled={promptSaving}
                className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                {promptSaving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          )}
        </div>
        {promptEditing ? (
          <textarea
            value={generalPrompt}
            onChange={e => setGeneralPrompt(e.target.value)}
            rows={10}
            className={`${inputCls} resize-y font-mono text-xs`}
          />
        ) : (
          <p className="text-xs text-gray-400 line-clamp-3 whitespace-pre-wrap">{generalPrompt}</p>
        )}
      </div>

      {/* Instructions + bouton générer */}
      <div className="bg-white rounded-lg shadow p-5">
        <Field label="Instructions pour cet article">
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            rows={5}
            placeholder={"Ex : Annonce de la sortie de Kazuki Tome 3.\nRésumé : Après avoir retrouvé sa magie, Kazuki doit affronter le Conseil des Arcanes...\nAuteurs : Magali et François Bonacci.\nISBN : 978-XXXXXXXXX\nPrix : 16,90 €"}
            className={`${inputCls} resize-y`}
          />
        </Field>
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleGenerer}
            disabled={generating || !instruction.trim()}
            className="px-5 py-2 bg-violet-600 text-white rounded text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating
              ? <><Spinner /> Génération en cours…</>
              : '✦ Générer avec Gemini Pro'}
          </button>
        </div>
      </div>

      {/* Zone résultat — visible seulement si contenu généré */}
      {(title || content || generating) && (
        <>
          {/* Titre + date + image à la une */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Titre de l'article">
                  <input type="text" value={title}
                    onChange={e => setTitle(e.target.value)}
                    className={inputCls}
                    placeholder={generating ? 'Génération en cours…' : ''} />
                </Field>
              </div>
              <Field label="Date de publication">
                <input type="datetime-local" value={date}
                  onChange={e => setDate(e.target.value)}
                  className={inputCls} />
              </Field>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={autoPublish}
                    onChange={e => setAutoPublish(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600" />
                  <span className="text-sm text-gray-700">Publier directement</span>
                </label>
              </div>

              {/* Image à la une */}
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-600 mb-2">Image à la une</p>
                <div className="flex items-start gap-4">
                  {/* Aperçu */}
                  {featuredImage ? (
                    <div className="relative group flex-shrink-0">
                      <img
                        src={featuredImage.src}
                        alt="Image à la une"
                        className={`w-32 h-20 object-cover rounded shadow border ${
                          featuredImage.pending ? 'border-yellow-300 opacity-60' : 'border-green-300'
                        }`}
                      />
                      {featuredImage.pending && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded">
                          <span className="text-xs text-yellow-600 font-medium">Upload…</span>
                        </div>
                      )}
                      {!featuredImage.pending && (
                        <button
                          type="button"
                          onClick={() => { URL.revokeObjectURL(featuredImage.src); setFeaturedImage(null) }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >×</button>
                      )}
                    </div>
                  ) : (
                    <div className="w-32 h-20 bg-gray-100 rounded border border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-gray-400">Aucune</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={featuredInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFeaturedUpload}
                      className="hidden"
                      id="featured-image-input"
                    />
                    <label
                      htmlFor="featured-image-input"
                      className={`px-3 py-1.5 border border-dashed border-gray-300 rounded text-sm text-gray-600 cursor-pointer hover:border-indigo-400 hover:text-indigo-600 transition-colors text-center ${
                        uploadingFeatured ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {uploadingFeatured ? 'Upload en cours…' : featuredImage && !featuredImage.pending ? '↺ Changer' : '+ Choisir une image'}
                    </label>
                    {featuredImage && !featuredImage.pending && (
                      <span className="text-xs text-green-600">✓ Uploadée sur WordPress</span>
                    )}
                    <p className="text-xs text-gray-400">Alt text, titre et légende SEO générés automatiquement.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Éditeur + Prévisualisation côte à côte */}
          <div className="grid grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
            {/* HTML brut */}
            <div className="bg-white rounded-lg shadow p-4 flex flex-col">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">HTML Gutenberg</p>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="flex-1 text-xs font-mono border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={generating ? 'Génération en cours…' : ''}
              />
            </div>

            {/* Prévisualisation */}
            <div className="bg-white rounded-lg shadow p-4 overflow-auto">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Prévisualisation</p>
              {content ? (
                <div
                  className="article-preview text-gray-800 text-sm"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <p className="text-xs text-gray-300 italic">La prévisualisation apparaîtra ici…</p>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Boutons publication */}
          {(title || content) && !generating && (
            <div className="flex justify-end gap-3">
              <button onClick={reset}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                Réinitialiser
              </button>
              <button
                onClick={() => handlePublier('draft')}
                disabled={publishing || !title.trim() || !content.trim()}
                className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-800 disabled:opacity-50">
                {publishing ? 'En cours…' : 'Créer en brouillon'}
              </button>
              <button
                onClick={() => handlePublier('publish')}
                disabled={publishing || !title.trim() || !content.trim()}
                className="px-5 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {publishing ? 'En cours…' : 'Publier sur le site'}
              </button>
            </div>
          )}
        </>
      )}

      {error && !title && !content && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  )
}

// ─── Onglet : Livraison ──────────────────────────────────────────────────────

function Livraison() {
  const [zones, setZones]                     = useState([])
  const [shippingClasses, setShippingClasses] = useState([])
  const [produits, setProduits]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(null)
  const [editModal, setEditModal]             = useState(null) // { zoneId, method }
  const [addModal, setAddModal]               = useState(null) // { zoneId }
  const [saving, setSaving]                   = useState(false)
  const [seeding, setSeeding]                 = useState(false)

  // Affecter aux produits
  const [selectedClass, setSelectedClass]         = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [comboValue, setComboValue]               = useState('')
  const [applying, setApplying]                   = useState(false)
  const [applyResult, setApplyResult]             = useState(null)

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    setError(null)
    try {
      const [zonesData, classesData, produitsData] = await Promise.all([
        site.getShipping(),
        site.getShippingClasses(),
        site.getProduitsLite()
      ])
      setZones(zonesData)
      setShippingClasses(classesData)
      setProduits(produitsData)
      setSelectedClass(c => c || (classesData[0]?.slug ?? ''))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSeed() {
    if (!confirm('Créer la zone "France métropolitaine" avec les tarifs La Poste (simple + suivie) ?')) return
    setSeeding(true)
    setError(null)
    try {
      await site.seedShipping()
      await charger()
    } catch (e) {
      setError(e.message)
    } finally {
      setSeeding(false)
    }
  }

  async function handleSauvegarder(data) {
    setSaving(true)
    try {
      await site.updateShippingMethod(editModal.zoneId, editModal.method.instance_id, data)
      setEditModal(null)
      await charger()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAjouter(methodId) {
    const zoneId = addModal.zoneId
    setSaving(true)
    try {
      const created = await site.addShippingMethod(zoneId, methodId)
      setAddModal(null)
      await charger()
      setEditModal({ zoneId, method: created })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSupprimer(zoneId, instanceId) {
    if (!confirm('Supprimer cette méthode de livraison ?')) return
    try {
      await site.deleteShippingMethod(zoneId, instanceId)
      await charger()
    } catch (e) {
      setError(e.message)
    }
  }

  function ajouterProduit() {
    const id = parseInt(comboValue)
    if (!id || selectedProductIds.includes(id)) return
    setSelectedProductIds(ids => [...ids, id])
    setComboValue('')
  }

  async function handleApplier(mode) {
    if (!selectedClass) return
    if (mode === 'selection' && !selectedProductIds.length) return
    setApplying(true)
    setApplyResult(null)
    try {
      const ids = mode === 'all' ? 'all' : selectedProductIds
      const result = await site.setProductsShippingClass(ids, selectedClass)
      setApplyResult(`${result.updated} produit${result.updated > 1 ? 's' : ''} mis à jour.`)
      if (mode === 'selection') setSelectedProductIds([])
    } catch (e) {
      setError(e.message)
    } finally {
      setApplying(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Chargement des zones de livraison…</div>

  const hasSeedButton = !zones.some(z => z.name === 'France métropolitaine')

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold flex-shrink-0">×</button>
        </div>
      )}

      {/* Bouton seed */}
      {hasSeedButton && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-800">Aucune zone "France métropolitaine" détectée</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Initialise automatiquement les tarifs La Poste avec les tranches de poids (5 classes, 2 méthodes).
            </p>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {seeding ? 'Initialisation…' : '⚡ Initialiser les tarifs La Poste'}
          </button>
        </div>
      )}

      {/* Zones */}
      {zones.length === 0 && !hasSeedButton ? (
        <div className="text-center py-12 text-gray-400 text-sm">Aucune zone de livraison.</div>
      ) : zones.map(zone => (
        <div key={zone.id} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {zone.name || 'Zone sans nom'}
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({zone.methods.length} méthode{zone.methods.length !== 1 ? 's' : ''})
              </span>
            </h3>
            <button
              onClick={() => setAddModal({ zoneId: zone.id })}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              + Ajouter
            </button>
          </div>

          {zone.methods.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-400 italic">Aucune méthode configurée.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide w-2/5">Méthode</th>
                  <th className="text-left px-5 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Tarif de base</th>
                  <th className="text-left px-5 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="px-5 py-2 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {zone.methods.map(method => (
                  <tr key={method.instance_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{method.title}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{METHOD_LABELS[method.method_id] || method.method_id}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {method.method_id === 'free_shipping'
                        ? <span className="text-green-600 text-xs font-medium">Gratuit</span>
                        : method.settings?.cost?.value
                          ? `${method.settings.cost.value} €`
                          : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        method.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {method.enabled ? 'Activé' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setEditModal({ zoneId: zone.id, method })}
                          className="text-xs text-indigo-600 hover:underline"
                        >Modifier</button>
                        <button
                          onClick={() => handleSupprimer(zone.id, method.instance_id)}
                          className="text-xs text-red-500 hover:underline"
                        >Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* Affecter une classe aux produits */}
      {shippingClasses.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Affecter une classe d'expédition aux produits</h3>
          <p className="text-xs text-gray-400 mb-4">
            La classe détermine la tranche de poids — WooCommerce calcule le tarif correspondant selon la zone du client.
          </p>

          <Field label="Classe (tranche de poids)">
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className={`${inputCls} max-w-xs`}>
              {shippingClasses.map(cls => (
                <option key={cls.id} value={cls.slug}>{cls.name}</option>
              ))}
            </select>
          </Field>

          <div className="mt-4 space-y-4">
            {/* Appliquer à tous */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleApplier('all')}
                disabled={applying || !selectedClass}
                className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {applying ? 'Application…' : 'Appliquer à tous les produits'}
              </button>
              <span className="text-xs text-gray-400">
                {produits.length} produit{produits.length !== 1 ? 's' : ''} sur WooCommerce
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="flex-1 border-t border-gray-200" />
              <span>ou sélectionner</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Sélection par produit */}
            <div>
              <div className="flex gap-2 mb-3">
                <select
                  value={comboValue}
                  onChange={e => setComboValue(e.target.value)}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">— Choisir un produit —</option>
                  {produits
                    .filter(p => !selectedProductIds.includes(p.id))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <button
                  onClick={ajouterProduit}
                  disabled={!comboValue}
                  className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800 disabled:opacity-40"
                >
                  + Ajouter
                </button>
              </div>

              {selectedProductIds.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedProductIds.map(id => {
                      const p = produits.find(p => p.id === id)
                      return (
                        <span key={id} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2 py-1 rounded">
                          {p?.name || `#${id}`}
                          <button
                            onClick={() => setSelectedProductIds(ids => ids.filter(i => i !== id))}
                            className="ml-1 text-indigo-400 hover:text-indigo-700 font-bold"
                          >×</button>
                        </span>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => handleApplier('selection')}
                    disabled={applying || !selectedClass}
                    className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {applying
                      ? 'Application…'
                      : `Appliquer aux ${selectedProductIds.length} produit${selectedProductIds.length > 1 ? 's' : ''} sélectionné${selectedProductIds.length > 1 ? 's' : ''}`}
                  </button>
                </>
              )}
            </div>
          </div>

          {applyResult && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700 flex items-center justify-between">
              <span>✓ {applyResult}</span>
              <button onClick={() => setApplyResult(null)} className="text-green-400 hover:text-green-600 text-xs font-bold">×</button>
            </div>
          )}
        </div>
      )}

      {editModal && (
        <EditMethodModal
          zoneId={editModal.zoneId}
          method={editModal.method}
          saving={saving}
          onClose={() => setEditModal(null)}
          onSave={handleSauvegarder}
        />
      )}
      {addModal && (
        <AddMethodModal
          saving={saving}
          onClose={() => setAddModal(null)}
          onAdd={handleAjouter}
        />
      )}
    </div>
  )
}

function EditMethodModal({ method, saving, onClose, onSave }) {
  const [title, setTitle]         = useState(method.title || '')
  const [enabled, setEnabled]     = useState(method.enabled ?? true)
  const [cost, setCost]           = useState(method.settings?.cost?.value || '')
  const [requires, setRequires]   = useState(method.settings?.requires?.value || '')
  const [minAmount, setMinAmount] = useState(method.settings?.min_amount?.value || '')

  const hasCost  = ['flat_rate', 'local_pickup'].includes(method.method_id)
  const isFree   = method.method_id === 'free_shipping'
  const needsMin = isFree && ['min_amount', 'either', 'both'].includes(requires)

  function handleSubmit(e) {
    e.preventDefault()
    const settings = {}
    if (hasCost) settings.cost = { value: cost }
    if (isFree) {
      settings.requires = { value: requires }
      if (needsMin) settings.min_amount = { value: minAmount }
    }
    onSave({ title, enabled, settings })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Modifier la méthode</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Titre affiché">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className={inputCls} />
          </Field>

          {hasCost && (
            <Field label="Tarif de base (€) — sans classe de poids">
              <input type="number" step="0.01" min="0" value={cost}
                onChange={e => setCost(e.target.value)} className={inputCls} placeholder="Ex : 5.00" />
            </Field>
          )}

          {isFree && (
            <>
              <Field label="Disponibilité">
                <select value={requires} onChange={e => setRequires(e.target.value)} className={inputCls}>
                  {REQUIRES_OPTIONS.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </Field>
              {needsMin && (
                <Field label="Montant minimum (€)">
                  <input type="number" step="0.01" min="0" value={minAmount}
                    onChange={e => setMinAmount(e.target.value)} className={inputCls} placeholder="Ex : 50.00" />
                </Field>
              )}
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600" />
            <span className="text-sm text-gray-700">Méthode activée</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddMethodModal({ saving, onClose, onAdd }) {
  const [methodId, setMethodId] = useState('flat_rate')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Ajouter une méthode</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Type de méthode">
            <select value={methodId} onChange={e => setMethodId(e.target.value)} className={inputCls}>
              {Object.entries(METHOD_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-gray-400">
            Créée avec les valeurs par défaut — la modale d'édition s'ouvrira automatiquement.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
              Annuler
            </button>
            <button onClick={() => onAdd(methodId)} disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

function todayISO() {
  const now = new Date()
  // Format pour datetime-local : "YYYY-MM-DDTHH:MM"
  return now.toISOString().slice(0, 16)
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
