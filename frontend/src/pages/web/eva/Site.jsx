import { useState, useEffect, useRef } from 'react'
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
        {[['ajouter', 'Ajouter un produit'], ['produits', 'Produits publiés'], ['articles', 'News / Articles']].map(([val, label]) => (
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

      {tab === 'ajouter' && <AjouterProduit />}
      {tab === 'produits' && <ListeProduits />}
      {tab === 'articles' && <NouvelArticle />}
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
  const [title, setTitle]   = useState('')
  const [content, setContent] = useState('')

  // Options publication
  const [date, setDate]         = useState(todayISO())
  const [autoPublish, setAutoPublish] = useState(false)

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

  async function handlePublier(status) {
    if (!title.trim() || !content.trim()) return
    setError(null)
    setPublishing(true)
    try {
      // Construire la date ISO complète si seulement la date est fournie
      const isoDate = date ? (date.includes('T') ? date : `${date}T08:00:00`) : undefined
      const result = await site.publierArticle({ title, content, date: isoDate, status })
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
          {/* Titre + date */}
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
