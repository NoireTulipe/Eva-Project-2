import { useState, useEffect } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { produits as produitsApi, ref as refApi, getImageUrl } from '../shared/api.js'
import { useToast } from '../shared/toast.jsx'

function eur(v) {
  const n = parseFloat(v)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(isNaN(n) ? 0 : n)
}

function parseDecimal(s) {
  const n = parseFloat(String(s).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export default function Stock() {
  const { show } = useToast()
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [loading, setLoading] = useState(true)
  const [produitEdite, setProduitEdite] = useState(null)
  const [produitImage, setProduitImage] = useState(null)
  const [showAjouter, setShowAjouter] = useState(false)

  useEffect(() => {
    charger()
    refApi.getAll('categories').then(setCategories)
  }, [])

  async function charger() {
    setLoading(true)
    try { setProduits(await produitsApi.getAll()) }
    finally { setLoading(false) }
  }

  const produitsFiltres = produits.filter(p => {
    const matchRech = !recherche || p.nom.toLowerCase().includes(recherche.toLowerCase())
    const matchCat = !filtreCategorie || String(p.categorieId) === filtreCategorie
    return matchRech && matchCat
  })

  const actifs = produitsFiltres.filter(p => p.actif !== false)
  const ruptures = actifs.filter(p => p.stock !== null && p.stock === 0)
  const alertes = actifs.filter(p => p.stock !== null && p.stockAlerte != null && p.stock > 0 && p.stock <= p.stockAlerte)

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 to-violet-700 pt-safe px-4 pb-5">
        <div className="flex items-center justify-between mt-1 mb-4">
          <h1 className="text-2xl font-bold text-white">Stock</h1>
          <button
            onClick={() => setShowAjouter(true)}
            className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
          >
            <span className="text-lg leading-none">+</span> Produit
          </button>
        </div>

        {(ruptures.length > 0 || alertes.length > 0) && (
          <div className="flex gap-2">
            {ruptures.length > 0 && (
              <div className="flex-1 bg-red-500/20 border border-red-400/30 rounded-2xl px-3 py-2.5 text-center">
                <p className="text-white font-extrabold text-xl leading-none">{ruptures.length}</p>
                <p className="text-red-200 text-xs mt-0.5">Rupture{ruptures.length > 1 ? 's' : ''}</p>
              </div>
            )}
            {alertes.length > 0 && (
              <div className="flex-1 bg-amber-500/20 border border-amber-400/30 rounded-2xl px-3 py-2.5 text-center">
                <p className="text-white font-extrabold text-xl leading-none">{alertes.length}</p>
                <p className="text-amber-200 text-xs mt-0.5">Alerte{alertes.length > 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recherche */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="search" value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <select value={filtreCategorie} onChange={e => setFiltreCategorie(e.target.value)}
            className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-600"
          >
            <option value="">Tous</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && <p className="text-center text-sm text-gray-400 pt-8">Chargement…</p>}
        {!loading && produitsFiltres.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Aucun produit trouvé</p>
          </div>
        )}
        {!loading && produitsFiltres.map(p => (
          <ProduitLigne
            key={p.id}
            produit={p}
            categorie={categories.find(c => c.id === p.categorieId)}
            onEdit={() => setProduitEdite(p)}
            onImage={() => setProduitImage(p)}
          />
        ))}
      </div>

      {produitEdite && (
        <EditStockSheet
          produit={produitEdite}
          onSave={async (val) => {
            try {
              const updated = await produitsApi.update(produitEdite.id, { stock: parseInt(val) })
              setProduits(prev => prev.map(p => p.id === updated.id ? updated : p))
              show('Stock mis à jour ✓', 'success')
              setProduitEdite(null)
            } catch (err) { show(err.message, 'error') }
          }}
          onClose={() => setProduitEdite(null)}
        />
      )}

      {produitImage && (
        <ImageProduitSheet
          produit={produitImage}
          onUpdate={(updated) => {
            setProduits(prev => prev.map(p => p.id === updated.id ? { ...p, imageUrl: updated.imageUrl } : p))
            setProduitImage(prev => ({ ...prev, imageUrl: updated.imageUrl }))
          }}
          onClose={() => setProduitImage(null)}
        />
      )}

      {showAjouter && (
        <AjouterProduitSheet
          categories={categories}
          onSave={async (data) => {
            try {
              const nvProd = await produitsApi.create(data)
              setProduits(prev => [...prev, nvProd])
              show(`"${nvProd.nom}" ajouté ✓`, 'success')
              setShowAjouter(false)
            } catch (err) { show(err.message, 'error') }
          }}
          onClose={() => setShowAjouter(false)}
        />
      )}
    </div>
  )
}

function ProduitLigne({ produit, categorie, onEdit, onImage }) {
  const stockNul = produit.stock !== null && produit.stock === 0
  const stockAlerte = produit.stock !== null && produit.stockAlerte != null && produit.stock > 0 && produit.stock <= produit.stockAlerte
  const inactif = produit.actif === false
  const stockInconnu = produit.stock === null

  const stockColor = inactif ? 'bg-gray-100 text-gray-400'
    : stockNul ? 'bg-red-100 text-red-600'
    : stockAlerte ? 'bg-amber-100 text-amber-700'
    : 'bg-emerald-100 text-emerald-700'

  const barColor = inactif ? 'bg-gray-200'
    : stockNul ? 'bg-red-400'
    : stockAlerte ? 'bg-amber-400'
    : 'bg-emerald-400'

  const imgUrl = getImageUrl(produit.imageUrl)

  return (
    <div className={`w-full bg-white rounded-2xl shadow-sm flex items-center gap-3 overflow-hidden ${inactif ? 'opacity-50' : ''}`}>
      {/* Tap principal → édition stock */}
      <button onClick={onEdit} className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
        <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${barColor}`} />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{produit.nom}</p>
          <p className="text-xs text-gray-400 mt-0.5">{categorie?.nom || '—'} · {eur(produit.prixVenteTTC)}</p>
        </div>

        <div className={`flex-shrink-0 rounded-2xl px-3 py-2 text-center min-w-[56px] ${stockInconnu ? 'bg-gray-100' : stockColor}`}>
          {stockInconnu ? (
            <p className="text-gray-400 text-xs font-medium leading-tight">Sans<br/>suivi</p>
          ) : stockNul ? (
            <p className="text-red-600 text-xs font-bold leading-tight">Rupture</p>
          ) : (
            <>
              <p className={`font-extrabold text-xl leading-none ${stockAlerte ? 'text-amber-700' : 'text-emerald-700'}`}>{produit.stock}</p>
              <p className={`text-xs font-semibold mt-0.5 ${stockAlerte ? 'text-amber-500' : 'text-emerald-500'}`}>ex.</p>
            </>
          )}
        </div>

        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Icône caméra discrète */}
      <button
        onClick={onImage}
        className="flex-shrink-0 pr-3 pl-1 py-3.5 flex items-center justify-center active:scale-90 transition-transform"
        aria-label="Image produit"
      >
        {imgUrl ? (
          <img src={imgUrl} className="w-8 h-8 rounded-lg object-cover border border-gray-100" alt="" />
        ) : (
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  )
}

function ImageProduitSheet({ produit, onUpdate, onClose }) {
  const { show } = useToast()
  const [preview, setPreview] = useState(null)   // data URL pour prévisualisation
  const [blob, setBlob] = useState(null)          // Blob à envoyer
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const imgUrl = getImageUrl(produit.imageUrl)

  async function prendrePhoto(source) {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source,
        quality: 80,
        allowEditing: false,
      })
      const dataUrl = `data:image/${photo.format};base64,${photo.base64String}`
      setPreview(dataUrl)
      // Convertir base64 → Blob
      const binary = atob(photo.base64String)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      setBlob(new Blob([bytes], { type: `image/${photo.format}` }))
    } catch (err) {
      if (!String(err).includes('cancelled') && !String(err).includes('User cancelled')) {
        show('Impossible d\'accéder à la caméra', 'error')
      }
    }
  }

  async function sauvegarder() {
    if (!blob) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('image', blob, `produit-${produit.id}.jpg`)
      const updated = await produitsApi.uploadImage(produit.id, formData)
      onUpdate(updated)
      show('Image mise à jour ✓', 'success')
      onClose()
    } catch (err) {
      show(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function supprimer() {
    setDeleting(true)
    try {
      const updated = await produitsApi.deleteImage(produit.id)
      onUpdate(updated)
      show('Image supprimée', 'success')
      onClose()
    } catch (err) {
      show(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const imageAffichee = preview || imgUrl

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl px-6 pt-5 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 truncate mb-4">{produit.nom}</h3>

        {/* Prévisualisation */}
        <div className="flex justify-center mb-5">
          {imageAffichee ? (
            <div className="relative">
              <img src={imageAffichee} className="w-36 h-48 object-cover rounded-2xl shadow-md border border-gray-100" alt="Couverture" />
              {preview && (
                <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">Nouveau</span>
              )}
            </div>
          ) : (
            <div className="w-36 h-48 bg-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-300">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">Aucune image</p>
            </div>
          )}
        </div>

        {/* Boutons de sélection */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => prendrePhoto(CameraSource.Photos)}
            className="py-3.5 bg-gray-100 rounded-2xl text-sm font-semibold text-gray-700 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Galerie
          </button>
          <button
            onClick={() => prendrePhoto(CameraSource.Camera)}
            className="py-3.5 bg-gray-100 rounded-2xl text-sm font-semibold text-gray-700 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Caméra
          </button>
        </div>

        {/* Sauvegarder */}
        {preview && (
          <button
            onClick={sauvegarder}
            disabled={saving}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-base active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-indigo-200 mb-3"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer cette image'}
          </button>
        )}

        {/* Supprimer */}
        {produit.imageUrl && !preview && (
          <button
            onClick={supprimer}
            disabled={deleting}
            className="w-full py-3.5 border border-red-200 text-red-500 rounded-2xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40"
          >
            {deleting ? 'Suppression…' : 'Supprimer l\'image'}
          </button>
        )}
      </div>
    </>
  )
}

function EditStockSheet({ produit, onSave, onClose }) {
  const [stockVal, setStockVal] = useState(String(produit.stock ?? ''))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (stockVal === '') return
    setSaving(true)
    await onSave(stockVal)
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl px-6 py-6 pb-safe">
        <div className="flex justify-center mb-5">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 truncate">{produit.nom}</h3>
        <p className="text-sm text-gray-400 mb-6">
          Stock actuel : <span className="font-semibold text-gray-600">{produit.stock ?? 'Non suivi'}</span>
          {' · '}<span className="text-indigo-600">{eur(produit.prixVenteTTC)}</span>
        </p>
        <input
          type="number"
          value={stockVal}
          onChange={e => setStockVal(e.target.value)}
          min="0"
          inputMode="numeric"
          className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-4xl font-extrabold text-center text-gray-800 focus:outline-none focus:border-indigo-500 mb-4"
          autoFocus
        />
        <button onClick={handleSave} disabled={saving || stockVal === ''}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-base active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-indigo-200"
        >
          {saving ? 'Enregistrement…' : 'Mettre à jour'}
        </button>
      </div>
    </>
  )
}

function AjouterProduitSheet({ categories, onSave, onClose }) {
  const [form, setForm] = useState({
    nom: '', prixVenteTTC: '', cout: '', stock: '', stockAlerte: '',
    categorieId: '', tva: '5.5', droitAuteurPourcent: '0'
  })
  const [saving, setSaving] = useState(false)

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  async function handleSave() {
    if (!form.nom.trim() || !form.prixVenteTTC) return
    setSaving(true)
    await onSave({
      nom: form.nom.trim(),
      prixVenteTTC: parseDecimal(form.prixVenteTTC),
      cout: parseDecimal(form.cout),
      tva: parseDecimal(form.tva),
      stock: form.stock !== '' ? parseInt(form.stock) : 0,
      stockAlerte: form.stockAlerte !== '' ? parseInt(form.stockAlerte) : 5,
      categorieId: form.categorieId ? parseInt(form.categorieId) : undefined,
      droitAuteurPourcent: parseDecimal(form.droitAuteurPourcent),
      droitAuteur: parseDecimal(form.droitAuteurPourcent) > 0,
      actif: true
    })
    setSaving(false)
  }

  const prixSaisi = parseDecimal(form.prixVenteTTC)
  const coutSaisi = parseDecimal(form.cout)
  const marge = prixSaisi > 0 && coutSaisi > 0 ? Math.round((1 - coutSaisi / prixSaisi) * 100) : null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex-shrink-0 px-6 pt-5 pb-3">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Nouveau produit</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          <Field label="Nom *">
            <input type="text" value={form.nom} onChange={e => set('nom', e.target.value)}
              placeholder="Titre du livre"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix TTC (€) *">
              <input type="text" value={form.prixVenteTTC} onChange={e => set('prixVenteTTC', e.target.value)}
                placeholder="15,00" inputMode="decimal" className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </Field>
            <Field label={`Prix coûtant${marge !== null ? ` — Marge ${marge}%` : ''}`}>
              <input type="text" value={form.cout} onChange={e => set('cout', e.target.value)}
                placeholder="8,00" inputMode="decimal" className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock initial">
              <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)}
                placeholder="20" inputMode="numeric" min="0" className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </Field>
            <Field label="Alerte stock">
              <input type="number" value={form.stockAlerte} onChange={e => set('stockAlerte', e.target.value)}
                placeholder="5" inputMode="numeric" min="0" className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <select value={form.categorieId} onChange={e => set('categorieId', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Aucune —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </Field>
            <Field label="TVA (%)">
              <input type="text" value={form.tva} onChange={e => set('tva', e.target.value)}
                inputMode="decimal" className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </Field>
          </div>

          <Field label="Droits auteur (%)">
            <input type="text" value={form.droitAuteurPourcent} onChange={e => set('droitAuteurPourcent', e.target.value)}
              inputMode="decimal" placeholder="0" className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </Field>
        </div>

        <div className="flex-shrink-0 px-6 py-4 pb-safe border-t border-gray-100">
          <button onClick={handleSave} disabled={saving || !form.nom.trim() || !form.prixVenteTTC}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-base active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-indigo-200"
          >
            {saving ? 'Ajout…' : 'Ajouter le produit'}
          </button>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}
