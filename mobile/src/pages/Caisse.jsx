import { useState, useEffect, useRef } from 'react'
import { produits as produitsApi, ref as refApi, ventes as ventesApi } from '../shared/api.js'
import { useSession } from '../shared/SessionContext.jsx'
import { useToast } from '../shared/toast.jsx'
import OuvrirSession from '../components/OuvrirSession.jsx'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

async function vibrer() {
  try { await Haptics.impact({ style: ImpactStyle.Light }) } catch {}
}

// ─── Formatage ────────────────────────────────────────────────────────────────

function eur(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
}

// ─── Caisse principale ────────────────────────────────────────────────────────

export default function Caisse() {
  const { session, loading: sessionLoading } = useSession()

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">Chargement…</div>
      </div>
    )
  }

  if (!session) return <OuvrirSession />

  return <CaisseActive session={session} />
}

// ─── Caisse active ────────────────────────────────────────────────────────────

function CaisseActive({ session }) {
  const { show } = useToast()
  const [categories, setCategories] = useState([])
  const [produits, setProduits] = useState([])
  const [methodes, setMethodes] = useState([])
  const [categorieActive, setCategorieActive] = useState('__tous__')
  const [panier, setPanier] = useState([]) // [{ produit, quantite }]
  const [showCart, setShowCart] = useState(false)
  const [showPaiement, setShowPaiement] = useState(false)
  const [methodePaiementId, setMethodePaiementId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const catRef = useRef(null)

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

  // Produits filtrés par catégorie
  const produitsFiltres = categorieActive === '__tous__'
    ? produits
    : produits.filter(p => p.categorieId === parseInt(categorieActive))

  // Total panier
  const totalPanier = panier.reduce((s, l) => s + l.produit.prixTTC * l.quantite, 0)
  const nbArticles = panier.reduce((s, l) => s + l.quantite, 0)

  function ajouterAuPanier(produit) {
    vibrer()
    setPanier(prev => {
      const idx = prev.findIndex(l => l.produit.id === produit.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], quantite: updated[idx].quantite + 1 }
        return updated
      }
      return [...prev, { produit, quantite: 1 }]
    })
  }

  function modifierQuantite(produitId, delta) {
    setPanier(prev => {
      const updated = prev.map(l =>
        l.produit.id === produitId ? { ...l, quantite: l.quantite + delta } : l
      ).filter(l => l.quantite > 0)
      return updated
    })
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
        prixUnitaire: l.produit.prixTTC
      }))
      await ventesApi.enregistrer(session.id, parseInt(methodePaiementId), lignes)
      viderPanier()
      show(`Vente de ${eur(totalPanier)} enregistrée !`, 'success')
      // Rafraîchir les stocks
      produitsApi.getAll().then(prods => setProduits(prods.filter(p => p.actif !== false)))
    } catch (err) {
      show(`Erreur : ${err.message}`, 'error')
    } finally {
      setSubmitting(false)
      setShowPaiement(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">

      {/* Header session */}
      <div className="flex-shrink-0 bg-indigo-600 pt-safe px-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wide">Session en cours</p>
            <p className="text-white font-semibold text-base">{session.pdvNom}</p>
          </div>
          <div className="bg-indigo-500 rounded-xl px-3 py-1.5">
            <p className="text-white text-xs">
              {new Date(session.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      {/* Onglets catégories */}
      <div
        ref={catRef}
        className="flex-shrink-0 flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none bg-white border-b border-gray-100"
      >
        <CategoryTab
          label="Tous"
          active={categorieActive === '__tous__'}
          count={produits.length}
          onClick={() => setCategorieActive('__tous__')}
        />
        {categories.map(cat => {
          const nb = produits.filter(p => p.categorieId === cat.id).length
          if (nb === 0) return null
          return (
            <CategoryTab
              key={cat.id}
              label={cat.nom}
              active={categorieActive === String(cat.id)}
              count={nb}
              onClick={() => setCategorieActive(String(cat.id))}
            />
          )
        })}
      </div>

      {/* Grille produits */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {produitsFiltres.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Aucun produit dans cette catégorie
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {produitsFiltres.map(p => {
              const ligneCart = panier.find(l => l.produit.id === p.id)
              return (
                <ProduitTile
                  key={p.id}
                  produit={p}
                  quantiteCart={ligneCart?.quantite || 0}
                  onPress={() => ajouterAuPanier(p)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Barre panier */}
      {nbArticles > 0 && (
        <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-200">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between bg-indigo-600 text-white px-5 py-4 rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white text-indigo-600 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                {nbArticles}
              </span>
              <span className="font-medium">Voir le panier</span>
            </div>
            <span className="font-bold text-lg">{eur(totalPanier)}</span>
          </button>
        </div>
      )}

      {/* Sheet panier */}
      {showCart && (
        <CartSheet
          panier={panier}
          total={totalPanier}
          methodes={methodes}
          methodePaiementId={methodePaiementId}
          setMethodePaiementId={setMethodePaiementId}
          onModifier={modifierQuantite}
          onVider={viderPanier}
          onValider={() => { setShowCart(false); setShowPaiement(true) }}
          onClose={() => setShowCart(false)}
        />
      )}

      {/* Modal confirmation paiement */}
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
    </div>
  )
}

// ─── Composant : onglet catégorie ─────────────────────────────────────────────

function CategoryTab({ label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 text-xs ${active ? 'text-indigo-200' : 'text-gray-400'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Composant : tuile produit ────────────────────────────────────────────────

function ProduitTile({ produit, quantiteCart, onPress }) {
  const stockFaible = produit.stock !== null && produit.alerteStock !== null && produit.stock <= produit.alerteStock
  const stockNul = produit.stock !== null && produit.stock === 0

  return (
    <button
      onClick={onPress}
      disabled={stockNul}
      className={`relative flex flex-col items-start justify-between bg-white rounded-2xl p-4 shadow-sm border-2 min-h-[110px] active:scale-95 transition-transform text-left w-full ${
        stockNul
          ? 'opacity-40 cursor-not-allowed border-gray-100'
          : quantiteCart > 0
            ? 'border-indigo-400 shadow-indigo-100'
            : 'border-transparent'
      }`}
    >
      {/* Badge quantité */}
      {quantiteCart > 0 && (
        <span className="absolute top-2.5 right-2.5 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {quantiteCart}
        </span>
      )}

      <div className="flex-1 pr-6">
        <p className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">
          {produit.nom}
        </p>
      </div>

      <div className="mt-2 w-full">
        <p className="text-indigo-600 font-bold text-base">{eur(produit.prixTTC)}</p>
        {produit.stock !== null && (
          <p className={`text-xs mt-0.5 ${stockFaible ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
            Stock : {produit.stock}
            {stockFaible && !stockNul && ' ⚠'}
            {stockNul && ' — Rupture'}
          </p>
        )}
      </div>
    </button>
  )
}

// ─── Sheet panier ─────────────────────────────────────────────────────────────

function CartSheet({ panier, total, methodes, methodePaiementId, setMethodePaiementId, onModifier, onVider, onValider, onClose }) {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Poignée */}
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Titre */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3">
          <h2 className="text-lg font-bold text-gray-800">Panier</h2>
          <button onClick={onVider} className="text-xs text-red-500 font-medium py-1 px-2">
            Vider
          </button>
        </div>

        {/* Liste articles */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">
          {panier.map(({ produit, quantite }) => (
            <div key={produit.id} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{produit.nom}</p>
                <p className="text-xs text-gray-500">{eur(produit.prixTTC)} / unité</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onModifier(produit.id, -1)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold active:scale-90 transition-transform"
                >−</button>
                <span className="w-6 text-center font-semibold text-gray-800">{quantite}</span>
                <button
                  onClick={() => onModifier(produit.id, +1)}
                  className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold active:scale-90 transition-transform"
                >+</button>
                <span className="w-16 text-right text-sm font-semibold text-gray-700">
                  {eur(produit.prixTTC * quantite)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Méthode de paiement */}
        <div className="flex-shrink-0 px-5 pt-3 pb-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Paiement</p>
          <div className="flex flex-wrap gap-2">
            {methodes.map(m => (
              <button
                key={m.id}
                onClick={() => setMethodePaiementId(String(m.id))}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  methodePaiementId === String(m.id)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {m.nom}
              </button>
            ))}
          </div>
        </div>

        {/* Bouton valider */}
        <div className="flex-shrink-0 px-5 py-4 pb-safe">
          <button
            onClick={onValider}
            disabled={!methodePaiementId}
            className="w-full py-4 bg-green-600 text-white rounded-2xl font-semibold text-base shadow-lg active:scale-95 transition-transform disabled:opacity-40"
          >
            Valider — {eur(total)}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Modal confirmation finale ────────────────────────────────────────────────

function PaiementModal({ total, methodes, methodePaiementId, setMethodePaiementId, submitting, onConfirmer, onAnnuler }) {
  const methodeLabel = methodes.find(m => String(m.id) === methodePaiementId)?.nom || ''

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Zone montant */}
        <div className="bg-green-600 px-6 py-8 text-center">
          <p className="text-green-100 text-sm font-medium mb-1">Montant total</p>
          <p className="text-white text-4xl font-bold">{eur(total)}</p>
          <p className="text-green-200 text-sm mt-2">{methodeLabel}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Choix méthode de paiement */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Méthode de paiement</p>
            <div className="flex flex-wrap gap-2">
              {methodes.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethodePaiementId(String(m.id))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    methodePaiementId === String(m.id)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {m.nom}
                </button>
              ))}
            </div>
          </div>

          {/* Boutons */}
          <button
            onClick={onConfirmer}
            disabled={submitting}
            className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base shadow active:scale-95 transition-transform disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : 'Confirmer la vente'}
          </button>
          <button
            onClick={onAnnuler}
            disabled={submitting}
            className="w-full py-3 text-gray-500 text-sm"
          >
            Retour au panier
          </button>
        </div>
      </div>
    </div>
  )
}
