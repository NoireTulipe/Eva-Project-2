import { useState, useEffect, useRef, useCallback } from 'react'
import { produits as produitsApi, ref as refApi, ventes as ventesApi, getThumbUrl } from '../shared/api.js'
import { getApiUrl, setApiUrl, getApiBase } from '../shared/api.js'
import { useSession } from '../shared/SessionContext.jsx'
import { useToast } from '../shared/toast.jsx'
import OuvrirSession from '../components/OuvrirSession.jsx'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

async function vibrer() {
  try { await Haptics.impact({ style: ImpactStyle.Light }) } catch {}
}

function eur(v) {
  const n = parseFloat(v)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(isNaN(n) ? 0 : n)
}

// ─── Palette couleurs catégories ───────────────────────────────────────────────

export const CAT_STYLES = [
  { key: 'violet', bg: 'bg-violet-500', text: 'text-violet-600', tab: 'bg-violet-600', hex: '#7c3aed' },
  { key: 'indigo', bg: 'bg-indigo-500', text: 'text-indigo-600', tab: 'bg-indigo-600', hex: '#4f46e5' },
  { key: 'pink',   bg: 'bg-pink-500',   text: 'text-pink-600',   tab: 'bg-pink-600',   hex: '#ec4899' },
  { key: 'amber',  bg: 'bg-amber-500',  text: 'text-amber-600',  tab: 'bg-amber-600',  hex: '#f59e0b' },
  { key: 'teal',   bg: 'bg-teal-500',   text: 'text-teal-600',   tab: 'bg-teal-600',   hex: '#14b8a6' },
  { key: 'rose',   bg: 'bg-rose-500',   text: 'text-rose-600',   tab: 'bg-rose-600',   hex: '#f43f5e' },
  { key: 'sky',    bg: 'bg-sky-500',    text: 'text-sky-600',    tab: 'bg-sky-600',    hex: '#0ea5e9' },
  { key: 'emerald',bg: 'bg-emerald-500',text: 'text-emerald-600',tab: 'bg-emerald-600',hex: '#10b981' },
]

function loadCatColors() {
  try { return JSON.parse(localStorage.getItem('cat_colors') || '{}') } catch { return {} }
}

function saveCatColors(colors) {
  localStorage.setItem('cat_colors', JSON.stringify(colors))
}

// ─── Rayons ────────────────────────────────────────────────────────────────────

const RAYONS = ['librairie', 'goodies']
const RAYON_LABELS = { librairie: 'Librairie', goodies: 'Goodies' }
const RAYON_COLORS = {
  librairie: { header: 'from-indigo-600 to-violet-700', badge: 'bg-indigo-600' },
  goodies:   { header: 'from-amber-500 to-orange-600',  badge: 'bg-amber-500'  },
}

function loadCatRayons() {
  try { return JSON.parse(localStorage.getItem('cat_rayons') || '{}') } catch { return {} }
}

function saveCatRayons(rayons) {
  localStorage.setItem('cat_rayons', JSON.stringify(rayons))
}

function buildCatStyleMap(categories, catColors) {
  const map = {}
  categories.forEach((c, i) => {
    const idx = catColors[String(c.id)] ?? (i % CAT_STYLES.length)
    map[c.id] = CAT_STYLES[idx]
  })
  return map
}

// ──────────────────────────────────────────────────────────────────────────────

export default function Caisse() {
  const { session, loading: sessionLoading } = useSession()

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-gray-400 text-sm">Chargement…</div>
      </div>
    )
  }

  if (!session) return <OuvrirSession />
  return <CaisseActive session={session} />
}

function CaisseActive({ session }) {
  const { show } = useToast()
  const [categories, setCategories] = useState([])
  const [produits, setProduits] = useState([])
  const [methodes, setMethodes] = useState([])
  const [categorieActive, setCategorieActive] = useState('__tous__')
  const [recherche, setRecherche] = useState('')
  const [panier, setPanier] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [showPaiement, setShowPaiement] = useState(false)
  const [methodePaiementId, setMethodePaiementId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl())
  const [catColors, setCatColors] = useState(loadCatColors)
  const [catRayons, setCatRayons] = useState(loadCatRayons)
  const [rayonActif, setRayonActif] = useState('librairie')
  const touchStartX = useRef(null)

  const chargerProduits = useCallback(() => {
    produitsApi.getAll().then(prods => setProduits(prods.filter(p => p.actif !== false)))
  }, [])

  useEffect(() => {
    Promise.all([
      produitsApi.getAll(),
      refApi.getAll('categories'),
      refApi.getAll('methodes-paiement')
    ]).then(([prods, cats, meths]) => {
      setProduits(prods.filter(p => p.actif !== false))
      setCategories(cats)
      setMethodes(meths)
      if (meths.length > 0) setMethodePaiementId(String(meths[0].id))
    })
  }, [])

  // Sync stock toutes les 45s
  useEffect(() => {
    const interval = setInterval(chargerProduits, 45000)
    return () => clearInterval(interval)
  }, [chargerProduits])

  const catStyleMap = buildCatStyleMap(categories, catColors)

  function setCouleurCategorie(catId, idx) {
    const updated = { ...catColors, [String(catId)]: idx }
    setCatColors(updated)
    saveCatColors(updated)
  }

  function setRayonCategorie(catId, rayon) {
    const updated = { ...catRayons, [String(catId)]: rayon }
    setCatRayons(updated)
    saveCatRayons(updated)
  }

  function changerRayon(direction) {
    const idx = RAYONS.indexOf(rayonActif)
    const newIdx = (idx + direction + RAYONS.length) % RAYONS.length
    setRayonActif(RAYONS[newIdx])
    setCategorieActive('__tous__')
  }

  function onSwipeTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function onSwipeTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 60) return
    changerRayon(delta > 0 ? 1 : -1)
  }

  const categoriesDuRayon = categories.filter(c => {
    const r = catRayons[String(c.id)]
    return !r || r === rayonActif
  })

  const produitsDuRayon = produits.filter(p => {
    const r = catRayons[String(p.categorieId)]
    return !r || r === rayonActif
  })

  const produitsFiltres = produitsDuRayon
    .filter(p => categorieActive === '__tous__' || p.categorieId === parseInt(categorieActive))
    .filter(p => !recherche || p.nom.toLowerCase().includes(recherche.toLowerCase()))

  const totalPanier = panier.reduce((s, l) => s + l.prixFinal * l.quantite, 0)
  const nbArticles = panier.reduce((s, l) => s + l.quantite, 0)

  function ajouterAuPanier(produit) {
    vibrer()
    const prix = parseFloat(produit.prixVenteTTC) || 0
    setPanier(prev => {
      const idx = prev.findIndex(l => l.produit.id === produit.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], quantite: updated[idx].quantite + 1 }
        return updated
      }
      return [...prev, { produit, quantite: 1, prixFinal: prix }]
    })
  }

  function modifierQuantite(produitId, delta) {
    setPanier(prev =>
      prev.map(l => l.produit.id === produitId ? { ...l, quantite: l.quantite + delta } : l)
         .filter(l => l.quantite > 0)
    )
  }

  function modifierPrix(produitId, nouveauPrix) {
    setPanier(prev =>
      prev.map(l => l.produit.id === produitId ? { ...l, prixFinal: parseFloat(nouveauPrix) || 0 } : l)
    )
  }

  function viderPanier() {
    setPanier([])
    setShowCart(false)
    setShowPaiement(false)
  }

  async function validerVente() {
    if (!methodePaiementId || panier.length === 0) return
    setSubmitting(true)
    try {
      const lignes = panier.map(l => ({
        produitId: l.produit.id,
        quantite: l.quantite,
        prixUnitaire: l.prixFinal
      }))
      await ventesApi.enregistrer(session.id, parseInt(methodePaiementId), lignes)
      viderPanier()
      show(`Vente enregistrée — ${eur(totalPanier)} ✓`, 'success')
      produitsApi.getAll().then(prods => setProduits(prods.filter(p => p.actif !== false)))
    } catch (err) {
      show(`Erreur : ${err.message}`, 'error')
    } finally {
      setSubmitting(false)
      setShowPaiement(false)
    }
  }

  function sauvegarderApi() {
    setApiUrl(apiUrlInput.trim().replace(/\/+$/, ''))
    setShowSettings(false)
    show('URL serveur mise à jour', 'success')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">

      {/* Header */}
      <div className={`flex-shrink-0 bg-gradient-to-r ${RAYON_COLORS[rayonActif].header} pt-safe px-4 pb-4 transition-colors duration-300`}>
        <div className="flex items-center justify-between mt-1">
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">{session.pdvNom}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <button onClick={() => changerRayon(-1)} className="text-white/50 text-lg leading-none active:text-white transition-colors">‹</button>
              <p className="text-white font-bold text-xl leading-tight">{RAYON_LABELS[rayonActif]}</p>
              <button onClick={() => changerRayon(1)} className="text-white/50 text-lg leading-none active:text-white transition-colors">›</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {nbArticles > 0 && (
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-2 text-right">
                <p className="text-white font-bold text-lg leading-none">{eur(totalPanier)}</p>
                <p className="text-white/60 text-xs">{nbArticles} art.</p>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Recherche */}
      <div className="flex-shrink-0 px-4 pt-3 pb-0 bg-white">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher un produit…"
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* Catégories */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none bg-white border-b border-gray-100">
        <button
          onClick={() => setCategorieActive('__tous__')}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
            categorieActive === '__tous__' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          Tous <span className="ml-1 text-xs opacity-60">{produitsDuRayon.length}</span>
        </button>
        {categoriesDuRayon.map(cat => {
          const nb = produitsDuRayon.filter(p => p.categorieId === cat.id).length
          if (nb === 0) return null
          const style = catStyleMap[cat.id]
          return (
            <button key={cat.id}
              onClick={() => setCategorieActive(String(cat.id))}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                categorieActive === String(cat.id) ? `${style.tab} text-white` : 'bg-gray-100 text-gray-500'
              }`}
            >
              {cat.nom} <span className="ml-1 text-xs opacity-60">{nb}</span>
            </button>
          )
        })}
      </div>

      {/* Grille produits */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        onTouchStart={onSwipeTouchStart}
        onTouchEnd={onSwipeTouchEnd}
      >
        {produitsFiltres.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Aucun produit</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {produitsFiltres.map(p => {
              const ligneCart = panier.find(l => l.produit.id === p.id)
              return (
                <ProduitTile
                  key={p.id}
                  produit={p}
                  quantiteCart={ligneCart?.quantite || 0}
                  catStyle={catStyleMap[p.categorieId]}
                  onPress={() => ajouterAuPanier(p)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Barre panier */}
      {nbArticles > 0 && (
        <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-100 shadow-lg">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-4 rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white text-indigo-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-extrabold">{nbArticles}</span>
              <span className="font-semibold">Voir le panier</span>
            </div>
            <span className="font-bold text-xl">{eur(totalPanier)}</span>
          </button>
        </div>
      )}

      {showCart && (
        <CartSheet
          panier={panier}
          total={totalPanier}
          methodes={methodes}
          methodePaiementId={methodePaiementId}
          setMethodePaiementId={setMethodePaiementId}
          onModifier={modifierQuantite}
          onModifierPrix={modifierPrix}
          onVider={viderPanier}
          onValider={() => { setShowCart(false); setShowPaiement(true) }}
          onClose={() => setShowCart(false)}
        />
      )}

      {showPaiement && (
        <PaiementModal
          total={totalPanier}
          methodes={methodes}
          methodePaiementId={methodePaiementId}
          setMethodePaiementId={setMethodePaiementId}
          submitting={submitting}
          onConfirmer={validerVente}
          onAnnuler={() => { setShowPaiement(false); setShowCart(true) }}
        />
      )}

      {/* Sheet paramètres : serveur + couleurs catégories */}
      {showSettings && (
        <SettingsSheet
          categories={categories}
          catStyleMap={catStyleMap}
          catColors={catColors}
          catRayons={catRayons}
          apiUrlInput={apiUrlInput}
          setApiUrlInput={setApiUrlInput}
          onSauvegarderApi={sauvegarderApi}
          onCouleur={setCouleurCategorie}
          onRayon={setRayonCategorie}
          onClose={() => setShowSettings(false)}
          produits={produits}
        />
      )}
    </div>
  )
}

// ─── Tuile produit ─────────────────────────────────────────────────────────────

function ProduitTile({ produit, quantiteCart, catStyle, onPress }) {
  const prix = parseFloat(produit.prixVenteTTC) || 0
  const stockNul = produit.stock !== null && produit.stock === 0
  const stockFaible = produit.stock !== null && produit.stockAlerte != null && produit.stock > 0 && produit.stock <= produit.stockAlerte
  const imgUrl = getThumbUrl(produit.imageUrl)

  return (
    <button
      onClick={onPress}
      disabled={stockNul}
      className={`relative flex flex-col justify-between bg-white rounded-2xl overflow-hidden shadow-sm min-h-[120px] active:scale-95 transition-transform text-left w-full border-2 ${
        stockNul ? 'opacity-40 cursor-not-allowed border-gray-100'
        : quantiteCart > 0 ? 'border-indigo-400 shadow-indigo-100 shadow-md'
        : 'border-transparent'
      }`}
    >
      {/* Barre couleur catégorie */}
      <div className={`h-1.5 w-full flex-shrink-0 ${catStyle?.bg || 'bg-gray-300'}`} />

      {quantiteCart > 0 && (
        <span className="absolute top-3 right-3 bg-indigo-600 text-white text-xs font-extrabold rounded-full w-6 h-6 flex items-center justify-center shadow z-10">
          {quantiteCart}
        </span>
      )}

      {/* Contenu : texte à gauche, image à droite */}
      <div className="flex flex-1 items-stretch min-h-0">
        {/* Texte */}
        <div className="flex-1 flex flex-col justify-between px-3 pt-2 pb-3 min-w-0">
          <p className="font-bold text-gray-800 text-sm leading-tight line-clamp-3 pr-1">{produit.nom}</p>
          <div className="mt-1">
            <p className={`font-extrabold text-base ${catStyle?.text || 'text-indigo-600'}`}>{eur(prix)}</p>
            {produit.stock !== null && (
              <p className={`text-xs mt-0.5 ${stockNul ? 'text-red-500 font-semibold' : stockFaible ? 'text-amber-500 font-semibold' : 'text-gray-400'}`}>
                {stockNul ? 'Rupture' : stockFaible ? `⚠ ${produit.stock} ex.` : `${produit.stock} ex.`}
              </p>
            )}
          </div>
        </div>

        {/* Image à droite */}
        {imgUrl && (
          <div className="flex-shrink-0 w-16 self-stretch">
            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Sheet paramètres ──────────────────────────────────────────────────────────

function SettingsSheet({ categories, catStyleMap, catColors, catRayons, apiUrlInput, setApiUrlInput, onSauvegarderApi, onCouleur, onRayon, onClose, produits }) {
  const [onglet, setOnglet] = useState('rayons') // 'rayons' | 'serveur' | 'couleurs' | 'debug'

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex-shrink-0 px-6 pt-5 pb-0">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
          </div>
          {/* Onglets */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
            <button onClick={() => setOnglet('rayons')} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${onglet === 'rayons' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>Rayons</button>
            <button onClick={() => setOnglet('couleurs')} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${onglet === 'couleurs' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>Couleurs</button>
            <button onClick={() => setOnglet('serveur')} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${onglet === 'serveur' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>Serveur</button>
            <button onClick={() => setOnglet('debug')} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${onglet === 'debug' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>Debug</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-safe">
          {onglet === 'rayons' && (
            <div className="py-2 space-y-1 pb-6">
              <p className="text-xs text-gray-400 mb-4">Assignez chaque catégorie à un rayon. Sans assignation, la catégorie apparaît dans les deux rayons.</p>

              {/* Librairie */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Librairie</p>
                </div>
                {categories.filter(c => catRayons[String(c.id)] === 'librairie').length === 0
                  ? <p className="text-xs text-gray-300 ml-4 mb-2">Aucune catégorie assignée</p>
                  : categories.filter(c => catRayons[String(c.id)] === 'librairie').map(cat => (
                    <div key={cat.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50">
                      <span className="flex-1 text-sm font-semibold text-gray-700 truncate">{cat.nom}</span>
                      <button
                        onClick={() => onRayon(cat.id, null)}
                        className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-semibold active:bg-gray-200"
                      >Retirer</button>
                    </div>
                  ))
                }
              </div>

              {/* Goodies */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-2 mt-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Goodies</p>
                </div>
                {categories.filter(c => catRayons[String(c.id)] === 'goodies').length === 0
                  ? <p className="text-xs text-gray-300 ml-4 mb-2">Aucune catégorie assignée</p>
                  : categories.filter(c => catRayons[String(c.id)] === 'goodies').map(cat => (
                    <div key={cat.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50">
                      <span className="flex-1 text-sm font-semibold text-gray-700 truncate">{cat.nom}</span>
                      <button
                        onClick={() => onRayon(cat.id, null)}
                        className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-semibold active:bg-gray-200"
                      >Retirer</button>
                    </div>
                  ))
                }
              </div>

              {/* Non assignées */}
              {categories.filter(c => !catRayons[String(c.id)]).length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Non assignées</p>
                  </div>
                  {categories.filter(c => !catRayons[String(c.id)]).map(cat => (
                    <div key={cat.id} className="flex items-center gap-2 py-2.5 border-b border-gray-50">
                      <span className="flex-1 text-sm font-semibold text-gray-500 truncate">{cat.nom}</span>
                      <button
                        onClick={() => onRayon(cat.id, 'librairie')}
                        className="text-xs text-white bg-indigo-600 px-3 py-1.5 rounded-lg font-semibold active:bg-indigo-700"
                      >Librairie</button>
                      <button
                        onClick={() => onRayon(cat.id, 'goodies')}
                        className="text-xs text-white bg-amber-500 px-3 py-1.5 rounded-lg font-semibold active:bg-amber-600"
                      >Goodies</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {onglet === 'serveur' && (
            <div className="py-2">
              <h3 className="text-base font-bold text-gray-800 mb-1">Serveur EVA</h3>
              <p className="text-xs text-gray-400 mb-4">URL actuelle : {getApiBase()}</p>
              <input
                type="url"
                value={apiUrlInput}
                onChange={e => setApiUrlInput(e.target.value)}
                placeholder="https://eva.echodeplumes.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <p className="text-xs text-gray-400 mb-4">Ex : http://192.168.1.42:3000</p>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500">
                  Annuler
                </button>
                <button onClick={onSauvegarderApi} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-bold">
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {onglet === 'debug' && (
            <div className="py-2 pb-6 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">Diagnostic images</p>
              <div className="bg-gray-900 rounded-xl p-3 space-y-1">
                <p className="text-green-400 text-xs font-mono">apiBase: {getApiBase()}</p>
                <p className="text-green-400 text-xs font-mono">origin: {getApiBase().replace(/\/api$/, '')}</p>
              </div>
              <p className="text-xs font-bold text-gray-500 uppercase mt-3">Produits avec image</p>
              {produits?.filter(p => p.imageUrl).length === 0
                ? <p className="text-xs text-gray-400">Aucun produit avec image</p>
                : produits?.filter(p => p.imageUrl).map(p => {
                    const url = getImageUrl(p.imageUrl)
                    return (
                      <div key={p.id} className="bg-gray-900 rounded-xl p-3 space-y-1">
                        <p className="text-white text-xs font-semibold truncate">{p.nom}</p>
                        <p className="text-yellow-400 text-xs font-mono break-all">imageUrl: {p.imageUrl}</p>
                        <p className="text-green-400 text-xs font-mono break-all">→ {url}</p>
                        <img src={url} className="w-12 h-16 object-cover rounded mt-1 border border-gray-600" alt=""
                          onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }}
                        />
                        <p className="text-red-400 text-xs hidden">Image non chargée</p>
                      </div>
                    )
                  })
              }
            </div>
          )}

          {onglet === 'couleurs' && (
            <div className="py-2 space-y-4 pb-6">
              <p className="text-xs text-gray-400">Choisissez une couleur par catégorie. Sauvegardé automatiquement.</p>
              {categories.map(cat => {
                const currentIdx = catColors[String(cat.id)] ?? (categories.indexOf(cat) % CAT_STYLES.length)
                return (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-semibold text-gray-700 truncate">{cat.nom}</span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {CAT_STYLES.map((style, idx) => (
                        <button
                          key={style.key}
                          onClick={() => onCouleur(cat.id, idx)}
                          className={`w-7 h-7 rounded-full transition-all active:scale-90 ${style.bg} ${
                            currentIdx === idx ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60'
                          }`}
                          aria-label={style.key}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Sheet panier ──────────────────────────────────────────────────────────────

function CartSheet({ panier, total, methodes, methodePaiementId, setMethodePaiementId, onModifier, onModifierPrix, onVider, onValider, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl flex flex-col max-h-[88vh]">
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3">
          <h2 className="text-xl font-bold text-gray-800">Panier</h2>
          <button onClick={onVider} className="text-xs text-red-500 font-semibold bg-red-50 px-3 py-1.5 rounded-lg">
            Vider
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
          {panier.map(({ produit, quantite, prixFinal }) => (
            <LignePanier
              key={produit.id}
              produit={produit}
              quantite={quantite}
              prixFinal={prixFinal}
              onModifier={delta => onModifier(produit.id, delta)}
              onModifierPrix={val => onModifierPrix(produit.id, val)}
            />
          ))}
        </div>

        <div className="flex-shrink-0 px-5 pt-3 pb-2 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Paiement</p>
          <div className="flex flex-wrap gap-2">
            {methodes.map(m => (
              <button key={m.id} onClick={() => setMethodePaiementId(String(m.id))}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  methodePaiementId === String(m.id) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                }`}
              >{m.nom}</button>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 px-5 py-4 pb-safe">
          <button onClick={onValider} disabled={!methodePaiementId}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-emerald-200 active:scale-95 transition-transform disabled:opacity-40"
          >
            Valider — {eur(total)}
          </button>
        </div>
      </div>
    </>
  )
}

function LignePanier({ produit, quantite, prixFinal, onModifier, onModifierPrix }) {
  const [editPrix, setEditPrix] = useState(false)
  const [prixInput, setPrixInput] = useState(String(prixFinal))
  const prixOriginal = parseFloat(produit.prixVenteTTC) || 0
  const remise = prixFinal < prixOriginal
  const majoration = prixFinal > prixOriginal

  function confirmerPrix() {
    const val = parseFloat(String(prixInput).replace(',', '.'))
    if (!isNaN(val) && val >= 0) onModifierPrix(val)
    setEditPrix(false)
  }

  return (
    <div className="bg-gray-50 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{produit.nom}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onModifier(-1)} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 font-bold shadow-sm active:scale-90 transition-transform">−</button>
          <span className="w-6 text-center font-bold text-gray-800">{quantite}</span>
          <button onClick={() => onModifier(+1)} className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm active:scale-90 transition-transform">+</button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {editPrix ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={prixInput}
              onChange={e => setPrixInput(e.target.value)}
              inputMode="decimal"
              className="w-24 border border-indigo-400 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none bg-white"
              autoFocus
              onBlur={confirmerPrix}
              onKeyDown={e => e.key === 'Enter' && confirmerPrix()}
            />
            <span className="text-xs text-gray-400">€ / unité</span>
            <button onClick={confirmerPrix} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg font-semibold">OK</button>
          </div>
        ) : (
          <button
            onClick={() => { setPrixInput(String(prixFinal)); setEditPrix(true) }}
            className="flex items-center gap-1.5 group"
          >
            <span className={`text-sm font-bold ${remise ? 'text-emerald-600' : majoration ? 'text-amber-600' : 'text-gray-700'}`}>
              {eur(prixFinal)} / unité
            </span>
            {remise && <span className="text-xs text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full font-semibold">Remise</span>}
            {majoration && <span className="text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full font-semibold">Majoration</span>}
            <svg className="w-3.5 h-3.5 text-gray-400 group-active:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        <span className="font-extrabold text-gray-800">{eur(prixFinal * quantite)}</span>
      </div>
    </div>
  )
}

// ─── Modal paiement ────────────────────────────────────────────────────────────

function PaiementModal({ total, methodes, methodePaiementId, setMethodePaiementId, submitting, onConfirmer, onAnnuler }) {
  const methodeLabel = methodes.find(m => String(m.id) === methodePaiementId)?.nom || ''

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-10 text-center">
          <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-2">Total à encaisser</p>
          <p className="text-white text-5xl font-extrabold">{eur(total)}</p>
          <p className="text-emerald-200 text-sm mt-3 font-medium">{methodeLabel}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Méthode de paiement</p>
            <div className="flex flex-wrap gap-2">
              {methodes.map(m => (
                <button key={m.id} onClick={() => setMethodePaiementId(String(m.id))}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    methodePaiementId === String(m.id) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >{m.nom}</button>
              ))}
            </div>
          </div>
          <button onClick={onConfirmer} disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-emerald-100 active:scale-95 transition-transform disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : '✓ Confirmer la vente'}
          </button>
          <button onClick={onAnnuler} disabled={submitting} className="w-full py-3 text-gray-400 text-sm font-medium">
            ← Retour au panier
          </button>
        </div>
      </div>
    </div>
  )
}
