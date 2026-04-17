import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { sessions as sessionsApi, frais as fraisApi, ref as refApi, ventes as ventesApi, pdv as pdvApi } from '../shared/api.js'
import { useSession } from '../shared/SessionContext.jsx'
import { useToast } from '../shared/toast.jsx'
import SwipeableRow from '../components/SwipeableRow.jsx'

const LIMITES = [10, 25, 50]
const STORAGE_LIMIT_KEY = 'hist_sessions_limit'

function eur(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(isNaN(parseFloat(v)) ? 0 : parseFloat(v))
}
function calcMontantVente(v) {
  return v.lignes?.reduce((s, l) => s + (parseFloat(l.prixUnitaire) || 0) * l.quantite * (1 - (parseFloat(l.remise) || 0) / 100), 0) || 0
}
function dateHeure(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Sessions() {
  const { session, fermerSession, ouvrirSession } = useSession()
  const { show } = useToast()
  const [sessionsOuvertes, setSessionsOuvertes] = useState([])
  const [sessionDetail, setSessionDetail] = useState(null)
  const [historique, setHistorique] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [showFrais, setShowFrais] = useState(false)
  const [fraisAModifier, setFraisAModifier] = useState(null)
  const [showOuvrir, setShowOuvrir] = useState(false)
  const [limite, setLimite] = useState(() => {
    const saved = parseInt(localStorage.getItem(STORAGE_LIMIT_KEY))
    return LIMITES.includes(saved) ? saved : 10
  })

  useEffect(() => { charger() }, [session?.id, limite])

  async function charger() {
    setLoading(true)
    try {
      const liste = await sessionsApi.getAll({ limit: limite + 20 })
      const ouvertes = liste.filter(s => s.statut === 'ouverte')
      setSessionsOuvertes(ouvertes)
      setHistorique(liste.filter(s => s.statut !== 'ouverte').slice(0, limite))
      if (session?.id) {
        const encoreOuverte = ouvertes.find(s => s.id === session.id)
        if (encoreOuverte) setSessionDetail(await sessionsApi.getById(session.id))
        else setSessionDetail(null)
      } else setSessionDetail(null)
    } catch (err) {
      show(`Erreur chargement : ${err.message}`, 'error')
    } finally { setLoading(false) }
  }

  async function selectionner(s) {
    ouvrirSession(s)
    try { setSessionDetail(await sessionsApi.getById(s.id)) } catch {}
    show(`📍 "${s.pointDeVente?.nom}" sélectionnée`, 'success')
  }

  async function annulerVente(venteId) {
    try {
      await ventesApi.annuler(venteId)
      show('↩️ Vente annulée', 'success')
      charger()
    } catch (err) { show(`Erreur : ${err.message}`, 'error') }
  }

  async function cloturer() {
    if (!sessionDetail) return
    try {
      await sessionsApi.cloturer(sessionDetail.id)
      fermerSession()
      show('✅ Session clôturée', 'success')
      setShowDetail(false)
      charger()
    } catch (err) { show(`Erreur : ${err.message}`, 'error') }
  }

  async function supprimerFrais(id) {
    try {
      await fraisApi.supprimer(id)
      show('🗑 Frais supprimé', 'success')
      charger()
    } catch (err) { show(err.message, 'error') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <p className="text-gray-400 text-sm">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 to-violet-700 pt-safe px-4 pb-5">
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <button onClick={() => setShowOuvrir(true)}
            className="flex items-center gap-1.5 bg-white/20 text-white text-sm font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ouvrir
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Sessions ouvertes */}
        {sessionsOuvertes.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm px-5 py-10 text-center border border-gray-100">
            <div className="text-5xl mb-3">🏪</div>
            <p className="text-gray-600 text-sm font-semibold">Aucune session en cours</p>
            <p className="text-gray-400 text-xs mt-1">Appuyez sur "Ouvrir" pour démarrer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionsOuvertes.map(s => {
              if (s.id === session?.id && sessionDetail) {
                return (
                  <SessionHeroCard
                    key={s.id}
                    session={sessionDetail}
                    onVoirDetail={() => setShowDetail(true)}
                    onAjouterFrais={() => setShowFrais(true)}
                  />
                )
              }
              return <SessionAutreCard key={s.id} session={s} onSelectionner={() => selectionner(s)} />
            })}
          </div>
        )}

        {/* Historique */}
        {historique.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">📋 Historique</p>
              <div className="flex gap-1">
                {LIMITES.map(l => (
                  <button key={l} onClick={() => { setLimite(l); localStorage.setItem(STORAGE_LIMIT_KEY, String(l)) }}
                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${limite === l ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {historique.map(s => <SessionHistoriqueCard key={s.id} sessionResume={s} />)}
            </div>
          </div>
        )}
      </div>

      {/* Vue plein écran session active */}
      {showDetail && sessionDetail && (
        <SessionDetailFullScreen
          session={sessionDetail}
          onClose={() => setShowDetail(false)}
          onAnnulerVente={annulerVente}
          onCloture={cloturer}
          onAjouterFrais={() => setShowFrais(true)}
          onModifierFrais={setFraisAModifier}
          onSupprimerFrais={supprimerFrais}
        />
      )}

      {/* Sheets formulaires */}
      {showFrais && sessionDetail && (
        <FraisSheet mode="ajouter" onSave={async (data) => {
          try {
            await fraisApi.ajouterSession(sessionDetail.id, data)
            show('💸 Frais ajouté ✓', 'success')
            setShowFrais(false)
            charger()
          } catch (err) { show(err.message, 'error') }
        }} onClose={() => setShowFrais(false)} />
      )}

      {fraisAModifier && (
        <FraisSheet mode="modifier" frais={fraisAModifier} onSave={async (data) => {
          try {
            await fraisApi.modifier(fraisAModifier.id, data)
            show('✏️ Frais modifié ✓', 'success')
            setFraisAModifier(null)
            charger()
          } catch (err) { show(err.message, 'error') }
        }} onClose={() => setFraisAModifier(null)} />
      )}

      {showOuvrir && (
        <OuvrirSessionSheet
          onOuverte={(s) => { ouvrirSession(s); setShowOuvrir(false); show(`🏪 "${s.pointDeVente?.nom}" ouverte !`, 'success'); charger() }}
          onClose={() => setShowOuvrir(false)}
        />
      )}
    </div>
  )
}

// ─── Card héro session active ─────────────────────────────────────────────────

function SessionHeroCard({ session, onVoirDetail, onAjouterFrais }) {
  const caTotal = session.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = session.ventes?.filter(v => !v.annulee).length || 0
  const totalFrais = session.frais?.reduce((s, f) => s + (parseFloat(f.montant) || 0), 0) || 0
  const net = caTotal - totalFrais

  return (
    <div className="rounded-3xl overflow-hidden shadow-xl">
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">🏪 Session active</p>
            <p className="text-white font-bold text-xl leading-tight">{session.pointDeVente?.nom}</p>
            <p className="text-indigo-300 text-xs mt-0.5">Depuis {dateHeure(session.debut)}</p>
          </div>
          <span className="flex items-center gap-1.5 bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MetriqueBloc label="💰 CA" value={eur(caTotal)} />
          <MetriqueBloc label={`🛒 ${nbVentes} vente${nbVentes !== 1 ? 's' : ''}`} value="" />
          <MetriqueBloc label="📊 Net" value={eur(net)} color={net >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
        </div>
      </div>
      <div className="bg-white flex divide-x divide-gray-100">
        <button onClick={onVoirDetail}
          className="flex-1 py-4 flex items-center justify-center gap-2 text-indigo-600 font-bold text-sm active:bg-indigo-50 transition-colors">
          Voir le détail
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button onClick={onAjouterFrais}
          className="flex-1 py-4 flex items-center justify-center gap-2 text-gray-500 font-semibold text-sm active:bg-gray-50 transition-colors">
          💸 Frais
        </button>
      </div>
    </div>
  )
}

function MetriqueBloc({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-white/10 rounded-2xl px-2 py-2.5 text-center">
      <p className="text-indigo-200 text-xs font-medium truncate">{label}</p>
      {value && <p className={`font-extrabold text-sm mt-0.5 truncate ${color}`}>{value}</p>}
    </div>
  )
}

// ─── Vue plein écran détail session ──────────────────────────────────────────

function SessionDetailFullScreen({ session, onClose, onAnnulerVente, onCloture, onAjouterFrais, onModifierFrais, onSupprimerFrais }) {
  const [visible, setVisible] = useState(false)
  const [onglet, setOnglet] = useState('ventes')
  const [cloturePending, setCloturePending] = useState(false)
  const containerRef = useRef(null)
  const headerRef = useRef(null)
  const cloturTimerRef = useRef(null)

  const caTotal = session.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = session.ventes?.filter(v => !v.annulee).length || 0
  const totalFrais = session.frais?.reduce((s, f) => s + (parseFloat(f.montant) || 0), 0) || 0
  const net = caTotal - totalFrais

  const produitsAgreges = useMemo(() => {
    const map = {}
    for (const v of (session.ventes || []).filter(v => !v.annulee)) {
      for (const l of (v.lignes || [])) {
        const key = l.produit?.id ?? l.produitId
        if (!map[key]) map[key] = { nom: l.produit?.nom || `#${key}`, qte: 0, total: 0 }
        map[key].qte += l.quantite
        map[key].total += (parseFloat(l.prixUnitaire) || 0) * l.quantite * (1 - (parseFloat(l.remise) || 0) / 100)
      }
    }
    return Object.values(map).sort((a, b) => b.qte - a.qte)
  }, [session.ventes])

  // Animation d'entrée
  useEffect(() => {
    let cancelled = false
    requestAnimationFrame(() => { if (!cancelled) setVisible(true) })
    return () => { cancelled = true }
  }, [])

  // Nettoyage timer
  useEffect(() => () => clearTimeout(cloturTimerRef.current), [])

  // Swipe bas pour fermer
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const header = headerRef.current, container = containerRef.current
    if (!header || !container) return
    const g = { active: false, startY: 0 }

    const onStart = (e) => { g.active = true; g.startY = e.touches[0].clientY }
    const onMove = (e) => {
      if (!g.active) return
      const dy = e.touches[0].clientY - g.startY
      if (dy > 0) container.style.transform = `translateY(${dy}px)`
    }
    const onEnd = () => {
      if (!g.active) return
      g.active = false
      const dy = parseFloat(container.style.transform.replace('translateY(', '').replace('px)', '')) || 0
      if (dy > 110) {
        onCloseRef.current()
      } else {
        container.style.transition = 'transform 0.3s ease-out'
        container.style.transform = 'translateY(0)'
        setTimeout(() => { if (container) container.style.transition = '' }, 300)
      }
    }
    header.addEventListener('touchstart', onStart, { passive: true })
    header.addEventListener('touchmove', onMove, { passive: false })
    header.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      header.removeEventListener('touchstart', onStart)
      header.removeEventListener('touchmove', onMove)
      header.removeEventListener('touchend', onEnd)
    }
  }, [])

  const handleClose = useCallback(() => {
    const c = containerRef.current
    if (c) {
      c.style.transition = 'transform 0.3s cubic-bezier(0.55, 0, 1, 0.45)'
      c.style.transform = 'translateY(100%)'
      setTimeout(onClose, 280)
    } else onClose()
  }, [onClose])

  function handleCloture() {
    if (!cloturePending) {
      setCloturePending(true)
      cloturTimerRef.current = setTimeout(() => setCloturePending(false), 4000)
    } else {
      clearTimeout(cloturTimerRef.current)
      onCloture()
    }
  }

  const TABS = [
    { id: 'ventes', label: `🛒 Paniers`, count: session.ventes?.length || 0 },
    { id: 'frais',  label: `💸 Frais`,   count: session.frais?.length || 0 },
    { id: 'produits', label: `📦 Produits`, count: produitsAgreges.length },
  ]

  return (
    <div className="fixed inset-0 z-50">
      <div
        ref={containerRef}
        className="h-full flex flex-col bg-slate-50"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: visible ? 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)' : 'none'
        }}
      >
        {/* Header swipeable (poignée + métriques) */}
        <div ref={headerRef} className="flex-shrink-0 bg-gradient-to-r from-indigo-600 to-violet-700 pt-safe select-none cursor-grab active:cursor-grabbing">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={handleClose}
                  className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center active:bg-white/30 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 12H5m7-7l-7 7 7 7" />
                  </svg>
                </button>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">{session.pointDeVente?.nom}</p>
                  <p className="text-indigo-200 text-xs">{dateHeure(session.debut)}</p>
                </div>
              </div>
              <button onClick={handleCloture}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${cloturePending ? 'bg-red-500 text-white shadow-lg' : 'bg-white/20 text-white'}`}>
                {cloturePending ? '⚠️ Confirmer ?' : 'Clôturer'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MetriqueBloc label="💰 CA" value={eur(caTotal)} />
              <MetriqueBloc label={`🛒 Ventes`} value={String(nbVentes)} />
              <MetriqueBloc label="💸 Frais" value={eur(totalFrais)} color="text-rose-300" />
              <MetriqueBloc label="📊 Net" value={eur(net)} color={net >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex-shrink-0 flex items-center bg-white border-b border-gray-100 px-3">
          <div className="flex flex-1">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setOnglet(tab.id)}
                className={`flex-1 py-3.5 text-xs font-bold transition-colors border-b-2 ${onglet === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400'}`}>
                {tab.label}
                {tab.count > 0 && <span className="ml-1 opacity-50">({tab.count})</span>}
              </button>
            ))}
          </div>
          {onglet === 'frais' && (
            <button onClick={onAjouterFrais}
              className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-lg font-light active:scale-90 transition-transform ml-2 flex-shrink-0">
              +
            </button>
          )}
        </div>

        {/* Contenu de l'onglet */}
        <div className="flex-1 overflow-y-auto">
          {onglet === 'ventes' && <VentesTab ventes={session.ventes || []} onAnnuler={onAnnulerVente} />}
          {onglet === 'frais'  && <FraisTab frais={session.frais || []} onAjouter={onAjouterFrais} onModifier={onModifierFrais} onSupprimer={onSupprimerFrais} />}
          {onglet === 'produits' && <ProduitsTab produits={produitsAgreges} />}
        </div>
      </div>
    </div>
  )
}

// ─── Onglet Ventes ────────────────────────────────────────────────────────────

function VentesTab({ ventes, onAnnuler }) {
  if (!ventes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-3">🛒</div>
        <p className="text-gray-400 text-sm">Aucune vente pour l'instant</p>
      </div>
    )
  }
  return (
    <div className="divide-y divide-gray-100 bg-white">
      {[...ventes].reverse().map(v => (
        <VenteLigne key={v.id} vente={v} onAnnuler={() => onAnnuler(v.id)} />
      ))}
    </div>
  )
}

function VenteLigne({ vente, onAnnuler }) {
  const montant = calcMontantVente(vente)
  const heure = new Date(vente.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  if (vente.annulee) {
    return (
      <div className="flex items-center px-4 py-3.5 bg-white opacity-40">
        <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full mr-3">↩️ Annulée</span>
        <p className="flex-1 text-xs text-gray-400 truncate">{vente.lignes?.map(l => `${l.produit?.nom} ×${l.quantite}`).join(', ')}</p>
        <span className="text-sm font-semibold text-gray-400 ml-2">{eur(montant)}</span>
      </div>
    )
  }

  return (
    <SwipeableRow actionsWidth={90} rightActions={[
      <button key="annuler" onClick={onAnnuler}
        className="w-full h-full bg-rose-500 text-white flex flex-col items-center justify-center gap-0.5 text-xs font-bold">
        <span className="text-xl">↩️</span>
        Annuler
      </button>
    ]}>
      <div className="flex items-center px-4 py-3.5 bg-white">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{vente.lignes?.map(l => `${l.produit?.nom} ×${l.quantite}`).join(', ') || '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{vente.methodePaiement?.nom} · {heure}</p>
        </div>
        <span className="text-sm font-bold text-gray-800 ml-3 flex-shrink-0">{eur(montant)}</span>
      </div>
    </SwipeableRow>
  )
}

// ─── Onglet Frais ─────────────────────────────────────────────────────────────

function FraisTab({ frais, onAjouter, onModifier, onSupprimer }) {
  if (!frais.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-3">💸</div>
        <p className="text-gray-400 text-sm mb-4">Aucun frais</p>
        <button onClick={onAjouter}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform">
          + Ajouter un frais
        </button>
      </div>
    )
  }
  return (
    <div className="divide-y divide-gray-100 bg-white">
      {frais.map(f => (
        <FraisLigne key={f.id} frais={f} onModifier={() => onModifier(f)} onSupprimer={() => onSupprimer(f.id)} />
      ))}
    </div>
  )
}

function FraisLigne({ frais, onModifier, onSupprimer }) {
  return (
    <SwipeableRow actionsWidth={140} rightActions={[
      <button key="modifier" onClick={onModifier}
        className="w-[70px] h-full bg-indigo-500 text-white flex flex-col items-center justify-center gap-0.5 text-xs font-bold">
        <span className="text-xl">✏️</span>
        Modifier
      </button>,
      <button key="supprimer" onClick={onSupprimer}
        className="w-[70px] h-full bg-rose-500 text-white flex flex-col items-center justify-center gap-0.5 text-xs font-bold">
        <span className="text-xl">🗑</span>
        Suppr.
      </button>
    ]}>
      <div className="flex items-center px-4 py-3.5 bg-white">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{frais.libelle}</p>
          <p className="text-xs text-gray-400 mt-0.5">{frais.typeFrais?.nom}</p>
        </div>
        <span className="text-sm font-bold text-rose-500 ml-3 flex-shrink-0">− {eur(frais.montant)}</span>
      </div>
    </SwipeableRow>
  )
}

// ─── Onglet Produits vendus ───────────────────────────────────────────────────

function ProduitsTab({ produits }) {
  if (!produits.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-3">📦</div>
        <p className="text-gray-400 text-sm">Aucun produit vendu</p>
      </div>
    )
  }
  const total = produits.reduce((s, p) => s + p.total, 0)
  const qteTotal = produits.reduce((s, p) => s + p.qte, 0)

  return (
    <div className="bg-white">
      {/* Résumé */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <p className="text-xs font-bold text-indigo-600">{qteTotal} exemplaire{qteTotal !== 1 ? 's' : ''} vendus</p>
        <p className="text-sm font-extrabold text-indigo-700">{eur(total)}</p>
      </div>
      <div className="divide-y divide-gray-100">
        {produits.map((p, i) => (
          <div key={i} className="flex items-center px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{p.nom}</p>
            </div>
            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full mx-3 flex-shrink-0">
              ×{p.qte}
            </span>
            <span className="text-sm font-bold text-gray-700 flex-shrink-0 w-20 text-right">{eur(p.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Card session ouverte non active ─────────────────────────────────────────

function SessionAutreCard({ session, onSelectionner }) {
  const caTotal = session.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = session.ventes?.filter(v => !v.annulee).length || 0

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-dashed border-indigo-200">
      <div className="px-4 py-3.5 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 bg-amber-400 rounded-full" />
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">🏪 Ouverte</p>
          </div>
          <p className="font-semibold text-gray-800 truncate">{session.pointDeVente?.nom}</p>
          <p className="text-xs text-gray-400 mt-0.5">{dateHeure(session.debut)} · {nbVentes} vente{nbVentes !== 1 ? 's' : ''} · {eur(caTotal)}</p>
        </div>
        <button onClick={onSelectionner}
          className="ml-3 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-sm">
          Sélectionner
        </button>
      </div>
    </div>
  )
}

// ─── Card historique ──────────────────────────────────────────────────────────

function SessionHistoriqueCard({ sessionResume }) {
  const [detail, setDetail] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const caTotal = sessionResume.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = sessionResume.ventes?.filter(v => !v.annulee).length || 0
  const nom = sessionResume.pointDeVente?.nom || `Session #${sessionResume.id}`

  async function toggle() {
    if (expanded) { setExpanded(false); return }
    if (!detail) {
      setLoading(true)
      try { setDetail(await sessionsApi.getById(sessionResume.id)) } finally { setLoading(false) }
    }
    setExpanded(true)
  }

  const sessionData = detail || sessionResume
  const caDetail = detail?.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) ?? caTotal

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">🏪 {nom}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sessionResume.debut ? dateHeure(sessionResume.debut) : ''}</p>
        </div>
        <div className="flex items-center gap-3 ml-3">
          <div className="text-right">
            <p className="font-bold text-indigo-600 text-sm">{eur(caTotal)}</p>
            <p className="text-xs text-gray-400">{nbVentes} vente{nbVentes !== 1 ? 's' : ''}</p>
          </div>
          <span className="text-gray-300">{loading ? '…' : expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {sessionData.ventes?.filter(v => !v.annulee).length > 0 ? (
            <>
              {sessionData.ventes.filter(v => !v.annulee).map(v => (
                <div key={v.id} className="flex items-center px-4 py-3 border-b border-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {v.lignes?.map(l => `${l.produit?.nom} ×${l.quantite}`).join(', ') || '—'}
                    </p>
                    <p className="text-xs text-gray-400">{v.methodePaiement?.nom}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{eur(calcMontantVente(v))}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3 bg-indigo-50">
                <span className="text-sm font-bold text-indigo-600">Total session</span>
                <span className="text-base font-extrabold text-indigo-700">{eur(caDetail)}</span>
              </div>
            </>
          ) : (
            <p className="px-4 py-4 text-xs text-gray-400 text-center">Aucune vente</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sheet frais (ajouter + modifier) ────────────────────────────────────────

function FraisSheet({ mode, frais, onSave, onClose }) {
  const [typesFrais, setTypesFrais] = useState([])
  const [typeFraisId, setTypeFraisId] = useState(mode === 'modifier' ? String(frais?.typeFraisId) : '')
  const [libelle, setLibelle] = useState(mode === 'modifier' ? (frais?.libelle || '') : '')
  const [montant, setMontant] = useState(mode === 'modifier' ? String(frais?.montant || '') : '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refApi.getAll('types-frais').then(t => {
      setTypesFrais(t)
      if (mode === 'ajouter' && t.length > 0) setTypeFraisId(String(t[0].id))
    })
  }, [])

  async function handleSave() {
    if (!typeFraisId || !libelle.trim() || !montant) return
    setSaving(true)
    await onSave({ typeFraisId: parseInt(typeFraisId), libelle: libelle.trim(), montant: parseFloat(String(montant).replace(',', '.')) })
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl px-6 pt-5 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-5">
          {mode === 'ajouter' ? '💸 Ajouter un frais' : '✏️ Modifier le frais'}
        </h3>
        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
            <select value={typeFraisId} onChange={e => setTypeFraisId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {typesFrais.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Libellé</label>
            <input type="text" value={libelle} onChange={e => setLibelle(e.target.value)}
              placeholder="Ex : Péage A7"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Montant (€)</label>
            <input type="text" value={montant} onChange={e => setMontant(e.target.value)}
              placeholder="12,50" inputMode="decimal"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving || !typeFraisId || !libelle.trim() || !montant}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-base active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-indigo-200">
          {saving ? 'Enregistrement…' : mode === 'ajouter' ? 'Ajouter' : 'Enregistrer'}
        </button>
      </div>
    </>
  )
}

// ─── Sheet ouvrir une session ─────────────────────────────────────────────────

function OuvrirSessionSheet({ onOuverte, onClose }) {
  const { show } = useToast()
  const [listePdv, setListePdv] = useState([])
  const [typesPdv, setTypesPdv] = useState([])
  const [pdvId, setPdvId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPdv, setLoadingPdv] = useState(true)
  const [showNouveauPdv, setShowNouveauPdv] = useState(false)

  useEffect(() => {
    Promise.all([pdvApi.getAll(), refApi.getAll('types-pdv')])
      .then(([pdvs, types]) => {
        setListePdv(pdvs)
        setTypesPdv(types)
        if (pdvs.length === 1) setPdvId(String(pdvs[0].id))
      })
      .finally(() => setLoadingPdv(false))
  }, [])

  async function ouvrir() {
    if (!pdvId) return
    setLoading(true)
    try { onOuverte(await sessionsApi.open(parseInt(pdvId))) }
    catch (err) { show(err.message, 'error') }
    finally { setLoading(false) }
  }

  const pdvSelectionne = listePdv.find(p => String(p.id) === pdvId)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl px-5 pt-5 pb-safe max-h-[85vh] flex flex-col">
        <div className="flex justify-center mb-4 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex-shrink-0">🏪 Nouvelle session</h3>

        <div className="flex-1 overflow-y-auto">
          {loadingPdv ? (
            <p className="py-8 text-center text-gray-400 text-sm">Chargement…</p>
          ) : listePdv.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Aucun point de vente configuré</p>
          ) : (
            <div className="space-y-2 mb-4">
              {listePdv.map(p => (
                <button key={p.id} onClick={() => setPdvId(String(p.id))}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${pdvId === String(p.id) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${pdvId === String(p.id) ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                    🏪
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${pdvId === String(p.id) ? 'text-indigo-700' : 'text-gray-800'}`}>{p.nom}</p>
                    {p.ville && <p className="text-xs text-gray-400 truncate">{p.ville}</p>}
                  </div>
                  {pdvId === String(p.id) && (
                    <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowNouveauPdv(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-sm active:scale-95 transition-colors mb-4">
            <span className="text-xl font-light">+</span> Nouveau point de vente
          </button>
        </div>

        <div className="flex gap-3 flex-shrink-0 pt-3">
          <button onClick={onClose} className="flex-1 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500">Annuler</button>
          <button onClick={ouvrir} disabled={!pdvId || loading}
            className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform">
            {loading ? 'Ouverture…' : pdvSelectionne ? `Ouvrir — ${pdvSelectionne.nom}` : 'Ouvrir'}
          </button>
        </div>
      </div>

      {showNouveauPdv && (
        <NouveauPdvSheet typesPdv={typesPdv}
          onSave={async (data) => {
            try {
              const nvPdv = await pdvApi.create(data)
              setListePdv(prev => [...prev, nvPdv])
              setPdvId(String(nvPdv.id))
              setShowNouveauPdv(false)
              show('✅ Point de vente créé !', 'success')
            } catch (err) { show(err.message, 'error') }
          }}
          onClose={() => setShowNouveauPdv(false)} />
      )}
    </>
  )
}

function NouveauPdvSheet({ typesPdv, onSave, onClose }) {
  const [nom, setNom] = useState('')
  const [typePDVId, setTypePDVId] = useState(typesPdv[0] ? String(typesPdv[0].id) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!nom.trim() || !typePDVId) return
    setSaving(true)
    await onSave({ nom: nom.trim(), typePDVId: parseInt(typePDVId) })
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl px-6 pt-5 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-5">🏪 Nouveau point de vente</h3>
        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom *</label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex : Salon du livre de Lyon"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Type *</label>
            <select value={typePDVId} onChange={e => setTypePDVId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">-- Sélectionner --</option>
              {typesPdv.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500">Annuler</button>
          <button onClick={handleSave} disabled={saving || !nom.trim() || !typePDVId}
            className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  )
}
