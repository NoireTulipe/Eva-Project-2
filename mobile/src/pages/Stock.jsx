import { useState, useEffect } from 'react'
import { produits as produitsApi, ref as refApi } from '../shared/api.js'
import { useToast } from '../shared/toast.jsx'

function eur(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
}

export default function Stock() {
  const { show } = useToast()
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [loading, setLoading] = useState(true)
  const [produitEdite, setProduitEdite] = useState(null)
  const [showAjouter, setShowAjouter] = useState(false)

  useEffect(() => {
    charger()
    refApi.getAll('categories').then(setCategories)
  }, [])

  async function charger() {
    setLoading(true)
    try {
      const prods = await produitsApi.getAll()
      setProduits(prods)
    } finally {
      setLoading(false)
    }
  }

  const produitsFiltres = produits.filter(p => {
    const matchRecherche = !recherche || p.nom.toLowerCase().includes(recherche.toLowerCase())
    const matchCategorie = !filtreCategorie || String(p.categorieId) === filtreCategorie
    return matchRecherche && matchCategorie
  })

  const actifs = produitsFiltres.filter(p => p.actif !== false)
  const ruptures = actifs.filter(p => p.stock !== null && p.stock === 0)
  const alertes  = actifs.filter(p => p.stock !== null && p.alerteStock !== null && p.stock > 0 && p.stock <= p.alerteStock)

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex-shrink-0 bg-white pt-safe px-4 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-800">Stock</h1>
          <button
            onClick={() => setShowAjouter(true)}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium active:scale-95 transition-transform"
          >
            <span className="text-lg leading-none">+</span>
            Produit
          </button>
        </div>

        {/* Stats rapides */}
        {(ruptures.length > 0 || alertes.length > 0) && (
          <div className="flex gap-2 mb-3">
            {ruptures.length > 0 && (
              <div className="flex-1 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center">
                <p className="text-red-600 font-bold text-lg">{ruptures.length}</p>
                <p className="text-red-500 text-xs">Rupture{ruptures.length > 1 ? 's' : ''}</p>
              </div>
            )}
            {alertes.length > 0 && (
              <div className="flex-1 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-center">
                <p className="text-orange-600 font-bold text-lg">{alertes.length}</p>
                <p className="text-orange-500 text-xs">Alerte{alertes.length > 1 ? 's' : ''} stock</p>
              </div>
            )}
          </div>
        )}

        {/* Recherche + filtre */}
        <div className="flex gap-2">
          <input
            type="search"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher…"
            className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <select
            value={filtreCategorie}
            onChange={e => setFiltreCategorie(e.target.value)}
            className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
          <p className="text-center text-sm text-gray-400 pt-8">Aucun produit trouvé</p>
        )}

        {!loading && produitsFiltres.map(p => (
          <ProduitLigne
            key={p.id}
            produit={p}
            categorie={categories.find(c => c.id === p.categorieId)}
            onEdit={() => setProduitEdite(p)}
          />
        ))}
      </div>

      {/* Sheet édition stock */}
      {produitEdite && (
        <EditStockSheet
          produit={produitEdite}
          onSave={async (stockVal) => {
            try {
              const updated = await produitsApi.update(produitEdite.id, { stock: parseInt(stockVal) })
              setProduits(prev => prev.map(p => p.id === updated.id ? updated : p))
              show('Stock mis à jour', 'success')
              setProduitEdite(null)
            } catch (err) {
              show(err.message, 'error')
            }
          }}
          onClose={() => setProduitEdite(null)}
        />
      )}

      {/* Sheet ajout produit */}
      {showAjouter && (
        <AjouterProduitSheet
          categories={categories}
          onSave={async (data) => {
            try {
              const nvProd = await produitsApi.create(data)
              setProduits(prev => [...prev, nvProd])
              show(`"${nvProd.nom}" ajouté`, 'success')
              setShowAjouter(false)
            } catch (err) {
              show(err.message, 'error')
            }
          }}
          onClose={() => setShowAjouter(false)}
        />
      )}
    </div>
  )
}

// ─── Ligne produit ─────────────────────────────────────────────────────────────

function ProduitLigne({ produit, categorie, onEdit }) {
  const stockNul   = produit.stock !== null && produit.stock === 0
  const stockAlerte = produit.stock !== null && produit.alerteStock !== null && produit.stock > 0 && produit.stock <= produit.alerteStock
  const inactif = produit.actif === false

  return (
    <button
      onClick={onEdit}
      className={`w-full bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm text-left active:scale-98 transition-transform ${inactif ? 'opacity-50' : ''}`}
    >
      {/* Indicateur stock */}
      <div className={`w-2 h-10 rounded-full flex-shrink-0 ${
        inactif ? 'bg-gray-200' :
        stockNul ? 'bg-red-400' :
        stockAlerte ? 'bg-orange-400' :
        'bg-green-400'
      }`} />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{produit.nom}</p>
        <p className="text-xs text-gray-400 mt-0.5">{categorie?.nom || '—'}</p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-bold text-indigo-600 text-sm">{eur(produit.prixTTC)}</p>
        <p className={`text-xs mt-0.5 font-medium ${
          stockNul ? 'text-red-500' : stockAlerte ? 'text-orange-500' : 'text-gray-400'
        }`}>
          {produit.stock === null ? 'Sans suivi' : `${produit.stock} ex.`}
        </p>
      </div>

      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// ─── Sheet édition stock ───────────────────────────────────────────────────────

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
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl px-6 py-6 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">{produit.nom}</h3>
        <p className="text-sm text-gray-500 mb-5">Stock actuel : {produit.stock ?? 'Non suivi'}</p>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Nouveau stock</label>
          <input
            type="number"
            value={stockVal}
            onChange={e => setStockVal(e.target.value)}
            min="0"
            inputMode="numeric"
            className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving || stockVal === ''}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-base active:scale-95 transition-transform disabled:opacity-40 mt-2"
          >
            {saving ? 'Enregistrement…' : 'Mettre à jour'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Sheet ajout produit ───────────────────────────────────────────────────────

function AjouterProduitSheet({ categories, onSave, onClose }) {
  const [form, setForm] = useState({
    nom: '', prixTTC: '', stock: '', alerteStock: '', categorieId: '', tva: 5.5, droitsAuteur: 0
  })
  const [saving, setSaving] = useState(false)

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  async function handleSave() {
    if (!form.nom.trim() || !form.prixTTC) return
    setSaving(true)
    await onSave({
      nom: form.nom.trim(),
      prixTTC: parseFloat(form.prixTTC),
      tva: parseFloat(form.tva),
      stock: form.stock !== '' ? parseInt(form.stock) : null,
      alerteStock: form.alerteStock !== '' ? parseInt(form.alerteStock) : null,
      categorieId: form.categorieId ? parseInt(form.categorieId) : null,
      droitsAuteur: parseFloat(form.droitsAuteur) || 0,
      actif: true
    })
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex-shrink-0 px-6 pt-5 pb-3">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Nouveau produit</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          <Field label="Nom *">
            <input
              type="text"
              value={form.nom}
              onChange={e => set('nom', e.target.value)}
              placeholder="Titre du livre"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix TTC (€) *">
              <input
                type="number"
                value={form.prixTTC}
                onChange={e => set('prixTTC', e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
            <Field label="TVA (%)">
              <input
                type="number"
                value={form.tva}
                onChange={e => set('tva', e.target.value)}
                inputMode="decimal"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock initial">
              <input
                type="number"
                value={form.stock}
                onChange={e => set('stock', e.target.value)}
                placeholder="Ex: 20"
                inputMode="numeric"
                min="0"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
            <Field label="Alerte stock">
              <input
                type="number"
                value={form.alerteStock}
                onChange={e => set('alerteStock', e.target.value)}
                placeholder="Ex: 5"
                inputMode="numeric"
                min="0"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </div>

          <Field label="Catégorie">
            <select
              value={form.categorieId}
              onChange={e => set('categorieId', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Aucune --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>

          <Field label="Droits auteur (%)">
            <input
              type="number"
              value={form.droitsAuteur}
              onChange={e => set('droitsAuteur', e.target.value)}
              inputMode="decimal"
              min="0"
              max="100"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>
        </div>

        <div className="flex-shrink-0 px-6 py-4 pb-safe border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving || !form.nom.trim() || !form.prixTTC}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-base active:scale-95 transition-transform disabled:opacity-40"
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
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
