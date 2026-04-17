import { useState, useEffect } from 'react'
import { sessions as sessionsApi, frais as fraisApi, ref as refApi, ventes as ventesApi, pdv as pdvApi } from '../shared/api.js'
import { useSession } from '../shared/SessionContext.jsx'
import { useToast } from '../shared/toast.jsx'

const LIMITES = [10, 25, 50]
const STORAGE_LIMIT_KEY = 'hist_sessions_limit'

function eur(v) {
  const n = parseFloat(v)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(isNaN(n) ? 0 : n)
}

function calcMontantVente(v) {
  if (!v.lignes?.length) return 0
  return v.lignes.reduce((s, l) => {
    const pu = parseFloat(l.prixUnitaire) || 0
    const remise = parseFloat(l.remise) || 0
    return s + pu * l.quantite * (1 - remise / 100)
  }, 0)
}

function dateHeure(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Sessions() {
  const { session, fermerSession, ouvrirSession } = useSession()
  const { show } = useToast()
  const [sessionsOuvertes, setSessionsOuvertes] = useState([])
  const [sessionDetail, setSessionDetail] = useState(null)
  const [historique, setHistorique] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCloture, setShowCloture] = useState(false)
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
      // On charge assez de sessions pour couvrir ouvertes + historique
      const liste = await sessionsApi.getAll({ limit: limite + 20 })
      const ouvertes = liste.filter(s => s.statut === 'ouverte')
      setSessionsOuvertes(ouvertes)
      // L'historique vient déjà avec pointDeVente.nom depuis getAll
      setHistorique(liste.filter(s => s.statut !== 'ouverte').slice(0, limite))

      if (session?.id) {
        const encoreOuverte = ouvertes.find(s => s.id === session.id)
        if (encoreOuverte) {
          setSessionDetail(await sessionsApi.getById(session.id))
        } else {
          setSessionDetail(null)
        }
      } else {
        setSessionDetail(null)
      }
    } catch (err) {
      show(`Erreur chargement : ${err.message}`, 'error')
    } finally { setLoading(false) }
  }

  async function selectionner(s) {
    ouvrirSession(s)
    try {
      setSessionDetail(await sessionsApi.getById(s.id))
    } catch {}
    show(`Session "${s.pointDeVente?.nom}" sélectionnée`, 'success')
  }

  async function annulerVente(venteId) {
    try {
      await ventesApi.annuler(venteId)
      show('Vente annulée', 'success')
      charger()
    } catch (err) { show(`Erreur : ${err.message}`, 'error') }
  }

  async function cloturer() {
    if (!sessionDetail) return
    try {
      await sessionsApi.cloturer(sessionDetail.id)
      fermerSession()
      show('Session clôturée', 'success')
      setShowCloture(false)
      charger()
    } catch (err) { show(`Erreur : ${err.message}`, 'error') }
  }

  function changerLimite(val) {
    setLimite(val)
    localStorage.setItem(STORAGE_LIMIT_KEY, String(val))
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
          <button
            onClick={() => setShowOuvrir(true)}
            className="flex items-center gap-1.5 bg-white/20 text-white text-sm font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform"
          >
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
          <div className="bg-white rounded-2xl shadow-sm px-5 py-6 text-center border border-gray-100">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">Aucune session en cours</p>
            <p className="text-gray-400 text-xs mt-1">Appuyez sur "Ouvrir" pour démarrer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionsOuvertes.map(s => {
              const estActive = s.id === session?.id
              if (estActive && sessionDetail) {
                return (
                  <SessionActiveCard
                    key={s.id}
                    session={sessionDetail}
                    onAnnulerVente={annulerVente}
                    onCloture={() => setShowCloture(true)}
                    onAjouterFrais={() => setShowFrais(true)}
                    onModifierFrais={(f) => setFraisAModifier(f)}
                    onSupprimerFrais={async (id) => {
                      try {
                        await fraisApi.supprimer(id)
                        show('Frais supprimé', 'success')
                        charger()
                      } catch (err) { show(err.message, 'error') }
                    }}
                  />
                )
              }
              return (
                <SessionAutreCard
                  key={s.id}
                  session={s}
                  onSelectionner={() => selectionner(s)}
                />
              )
            })}
          </div>
        )}

        {/* Historique */}
        {historique.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Historique</h2>
              {/* Sélecteur de limite */}
              <div className="flex items-center gap-1">
                {LIMITES.map(l => (
                  <button
                    key={l}
                    onClick={() => changerLimite(l)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
                      limite === l ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {historique.map(s => (
                <SessionHistoriqueCard key={s.id} sessionResume={s} />
              ))}
            </div>
          </div>
        )}
      </div>

      {showCloture && sessionDetail && (
        <CloturModal session={sessionDetail} onConfirmer={cloturer} onAnnuler={() => setShowCloture(false)} />
      )}

      {showFrais && sessionDetail && (
        <AjouterFraisSheet
          sessionId={sessionDetail.id}
          onSave={async (data) => {
            try {
              await fraisApi.ajouterSession(sessionDetail.id, data)
              show('Frais ajouté ✓', 'success')
              setShowFrais(false)
              charger()
            } catch (err) { show(err.message, 'error') }
          }}
          onClose={() => setShowFrais(false)}
        />
      )}

      {fraisAModifier && (
        <ModifierFraisSheet
          frais={fraisAModifier}
          onSave={async (data) => {
            try {
              await fraisApi.modifier(fraisAModifier.id, data)
              show('Frais modifié ✓', 'success')
              setFraisAModifier(null)
              charger()
            } catch (err) { show(err.message, 'error') }
          }}
          onClose={() => setFraisAModifier(null)}
        />
      )}

      {showOuvrir && (
        <OuvrirSessionSheet
          onOuverte={(s) => {
            ouvrirSession(s)
            setShowOuvrir(false)
            show(`Session "${s.pointDeVente?.nom}" ouverte !`, 'success')
            charger()
          }}
          onClose={() => setShowOuvrir(false)}
        />
      )}
    </div>
  )
}

// ─── Card session active ──────────────────────────────────────────────────────

function SessionActiveCard({ session, onAnnulerVente, onCloture, onAjouterFrais, onModifierFrais, onSupprimerFrais }) {
  const [expanded, setExpanded] = useState(false)
  const [showProduits, setShowProduits] = useState(false)
  const caTotal = session.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = session.ventes?.filter(v => !v.annulee).length || 0
  const totalFrais = session.frais?.reduce((s, f) => s + (parseFloat(f.montant) || 0), 0) || 0
  const net = caTotal - totalFrais

  return (
    <div className="bg-white rounded-3xl shadow-md overflow-hidden ring-2 ring-indigo-400">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-5 py-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Session de travail</p>
            <p className="text-white font-bold text-lg leading-tight">{session.pointDeVente?.nom}</p>
            <p className="text-indigo-200 text-xs mt-1">{dateHeure(session.debut)}</p>
          </div>
          <span className="flex items-center gap-1.5 bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MetriqueCard label="CA" value={eur(caTotal)} accent />
          <MetriqueCard label="Ventes" value={String(nbVentes)} />
          <MetriqueCard label="Net" value={eur(net)} highlight={net > 0} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={() => setExpanded(!expanded)}
          className="py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 active:scale-95 transition-transform">
          {expanded ? 'Masquer paniers' : `Paniers (${session.ventes?.length || 0})`}
        </button>
        <button onClick={() => setShowProduits(true)}
          className="py-3 bg-indigo-50 rounded-xl text-sm font-semibold text-indigo-600 active:scale-95 transition-transform">
          Produits vendus
        </button>
        <button onClick={onAjouterFrais}
          className="py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 active:scale-95 transition-transform">
          + Frais
        </button>
        <button onClick={onCloture}
          className="py-3 bg-red-50 rounded-xl text-sm font-bold text-red-600 active:scale-95 transition-transform">
          Clôturer
        </button>
      </div>

      {/* Frais de session */}
      {session.frais?.length > 0 && (
        <div className="border-b border-gray-100">
          <p className="px-5 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-widest">Frais</p>
          {session.frais.map(f => (
            <FraisLigne key={f.id} frais={f} onModifier={() => onModifierFrais(f)} onSupprimer={() => onSupprimerFrais(f.id)} />
          ))}
        </div>
      )}

      {expanded && session.ventes?.length > 0 && (
        <div className="divide-y divide-gray-50">
          {[...session.ventes].reverse().map(v => (
            <VenteLigne key={v.id} vente={v} onAnnuler={() => onAnnulerVente(v.id)} />
          ))}
        </div>
      )}

      {showProduits && (
        <ProduitsVendusSheet
          ventes={session.ventes || []}
          onClose={() => setShowProduits(false)}
        />
      )}
    </div>
  )
}

function FraisLigne({ frais, onModifier, onSupprimer }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">{frais.libelle}</p>
        <p className="text-xs text-gray-400">{frais.typeFrais?.nom}</p>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <span className="text-sm font-bold text-red-500">−{eur(frais.montant)}</span>
        {confirm ? (
          <>
            <button onClick={onSupprimer} className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">Oui</button>
            <button onClick={() => setConfirm(false)} className="px-2.5 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs">Non</button>
          </>
        ) : (
          <>
            <button onClick={onModifier} className="p-1.5 bg-gray-100 rounded-lg active:scale-95 transition-transform">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
              </svg>
            </button>
            <button onClick={() => setConfirm(true)} className="p-1.5 bg-red-50 rounded-lg active:scale-95 transition-transform">
              <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Card session ouverte non sélectionnée ────────────────────────────────────

function SessionAutreCard({ session, onSelectionner }) {
  const caTotal = session.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = session.ventes?.filter(v => !v.annulee).length || 0

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-dashed border-indigo-200">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-amber-400 rounded-full" />
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Session ouverte</p>
          </div>
          <p className="font-semibold text-gray-800 truncate">{session.pointDeVente?.nom}</p>
          <p className="text-xs text-gray-400 mt-0.5">{dateHeure(session.debut)} · {nbVentes} vente{nbVentes !== 1 ? 's' : ''} · {eur(caTotal)}</p>
        </div>
        <button
          onClick={onSelectionner}
          className="ml-4 flex-shrink-0 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-sm shadow-indigo-200"
        >
          Sélectionner
        </button>
      </div>
    </div>
  )
}

function MetriqueCard({ label, value, accent, highlight }) {
  return (
    <div className={`rounded-2xl px-3 py-3 text-center ${accent ? 'bg-white/20' : 'bg-white/10'}`}>
      <p className="text-indigo-200 text-xs font-semibold">{label}</p>
      <p className={`font-extrabold text-base mt-0.5 ${highlight ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function VenteLigne({ vente, onAnnuler }) {
  const [confirm, setConfirm] = useState(false)
  const montant = calcMontantVente(vente)

  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${vente.annulee ? 'opacity-40' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 text-sm">{eur(montant)}</span>
          {vente.annulee && <span className="text-xs text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded-full">Annulée</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {vente.methodePaiement?.nom} · {new Date(vente.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {vente.lignes?.length > 0 && (
          <p className="text-xs text-gray-400 truncate">{vente.lignes.map(l => `${l.produit?.nom} ×${l.quantite}`).join(', ')}</p>
        )}
      </div>
      {!vente.annulee && (
        confirm ? (
          <div className="flex gap-1.5 ml-3">
            <button onClick={onAnnuler} className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold">Oui</button>
            <button onClick={() => setConfirm(false)} className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-xs font-semibold">Non</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="ml-3 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-semibold border border-red-100 active:scale-95 transition-transform">
            Annuler
          </button>
        )
      )}
    </div>
  )
}

// ─── Card historique — affiche le résumé sans clic requis ─────────────────────

function SessionHistoriqueCard({ sessionResume }) {
  const [detail, setDetail] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  // Calculs depuis le résumé (getAll renvoie les ventes de base)
  const caTotal = sessionResume.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = sessionResume.ventes?.filter(v => !v.annulee).length || 0

  // Nom + date déjà disponibles depuis getAll
  const nom = sessionResume.pointDeVente?.nom || `Session #${sessionResume.id}`
  const dateStr = sessionResume.debut ? dateHeure(sessionResume.debut) : ''

  async function toggle() {
    if (expanded) { setExpanded(false); return }
    if (!detail) {
      setLoading(true)
      try {
        const s = await sessionsApi.getById(sessionResume.id)
        setDetail(s)
      } finally { setLoading(false) }
    }
    setExpanded(true)
  }

  const sessionData = detail || sessionResume
  const caDetail = detail?.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) ?? caTotal

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-4 text-left active:bg-gray-50 transition-colors">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{nom}</p>
          <p className="text-xs text-gray-400 mt-0.5">{dateStr}</p>
        </div>
        <div className="text-right flex items-center gap-3">
          <div>
            <p className="font-bold text-indigo-600 text-sm">{eur(caTotal)}</p>
            <p className="text-xs text-gray-400">{nbVentes} vente{nbVentes !== 1 ? 's' : ''}</p>
          </div>
          <span className="text-gray-300 text-sm">{loading ? '…' : expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {sessionData.ventes?.filter(v => !v.annulee).length > 0 ? (
            <>
              {sessionData.ventes.filter(v => !v.annulee).map(v => {
                const montant = calcMontantVente(v)
                return (
                  <div key={v.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                    <div>
                      <p className="text-xs font-medium text-gray-700 truncate max-w-[200px]">
                        {v.lignes?.map(l => `${l.produit?.nom} ×${l.quantite}`).join(', ') || '—'}
                      </p>
                      <p className="text-xs text-gray-400">{v.methodePaiement?.nom}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-800">{eur(montant)}</span>
                  </div>
                )
              })}
              <div className="flex justify-between items-center px-5 py-3 bg-indigo-50">
                <span className="text-sm font-bold text-indigo-600">Total session</span>
                <span className="text-base font-extrabold text-indigo-700">{eur(caDetail)}</span>
              </div>
            </>
          ) : (
            <p className="px-5 py-4 text-xs text-gray-400 text-center">Aucune vente</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modale clôture ───────────────────────────────────────────────────────────

function CloturModal({ session, onConfirmer, onAnnuler }) {
  const caTotal = session.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = session.ventes?.filter(v => !v.annulee).length || 0
  const totalFrais = session.frais?.reduce((s, f) => s + (parseFloat(f.montant) || 0), 0) || 0
  const resultat = caTotal - totalFrais

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full shadow-2xl px-6 pb-safe">
        <div className="flex justify-center pt-4 mb-5">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-5">Clôturer la session</h3>

        <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl p-5 space-y-3 mb-6 border border-indigo-100">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">{nbVentes} vente{nbVentes > 1 ? 's' : ''}</span>
            <span className="font-bold text-gray-800">{eur(caTotal)}</span>
          </div>
          {totalFrais > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Frais</span>
              <span className="font-bold text-red-500">− {eur(totalFrais)}</span>
            </div>
          )}
          <div className="border-t border-indigo-100 pt-3 flex justify-between items-center">
            <span className="font-bold text-gray-700">Résultat net</span>
            <span className={`text-xl font-extrabold ${resultat >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{eur(resultat)}</span>
          </div>
        </div>

        <button onClick={onConfirmer}
          className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold text-base active:scale-95 transition-transform mb-3 shadow-lg shadow-red-100">
          Clôturer définitivement
        </button>
        <button onClick={onAnnuler} className="w-full py-3 text-gray-400 text-sm font-medium mb-2">
          Annuler
        </button>
      </div>
    </div>
  )
}

// ─── Sheet ajouter frais ──────────────────────────────────────────────────────

function AjouterFraisSheet({ sessionId, onSave, onClose }) {
  const [typesFrais, setTypesFrais] = useState([])
  const [typeFraisId, setTypeFraisId] = useState('')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refApi.getAll('types-frais').then(t => {
      setTypesFrais(t)
      if (t.length > 0) setTypeFraisId(String(t[0].id))
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
        <div className="flex justify-center mb-5">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-5">Ajouter un frais</h3>

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
          {saving ? 'Ajout…' : 'Ajouter le frais'}
        </button>
      </div>
    </>
  )
}

// ─── Sheet produits vendus ────────────────────────────────────────────────────

function ProduitsVendusSheet({ ventes, onClose }) {
  const ventesValides = ventes.filter(v => !v.annulee)

  // Agrège les lignes par produit
  const parProduit = {}
  for (const v of ventesValides) {
    for (const l of (v.lignes || [])) {
      const key = l.produit?.id ?? l.produitId
      if (!parProduit[key]) {
        parProduit[key] = { nom: l.produit?.nom || `#${key}`, qte: 0, total: 0 }
      }
      const pu = parseFloat(l.prixUnitaire) || 0
      const remise = parseFloat(l.remise) || 0
      parProduit[key].qte += l.quantite
      parProduit[key].total += pu * l.quantite * (1 - remise / 100)
    }
  }

  const lignes = Object.values(parProduit).sort((a, b) => b.qte - a.qte)
  const totalGlobal = lignes.reduce((s, l) => s + l.total, 0)
  const qteGlobale = lignes.reduce((s, l) => s + l.qte, 0)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex-shrink-0 px-6 pt-5 pb-3">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">Produits vendus</h3>
            <span className="text-sm text-gray-400">{qteGlobale} ex. · {eur(totalGlobal)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-safe">
          {lignes.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Aucune vente</p>
          ) : (
            <div className="space-y-1 pb-4">
              {lignes.map((l, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{l.nom}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-3 flex-shrink-0">
                    <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full">×{l.qte}</span>
                    <span className="text-sm font-bold text-gray-700 w-20 text-right">{eur(l.total)}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3">
                <span className="text-sm font-bold text-indigo-600">Total</span>
                <span className="text-base font-extrabold text-indigo-700">{eur(totalGlobal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Sheet modifier un frais ──────────────────────────────────────────────────

function ModifierFraisSheet({ frais, onSave, onClose }) {
  const [typesFrais, setTypesFrais] = useState([])
  const [typeFraisId, setTypeFraisId] = useState(String(frais.typeFraisId))
  const [libelle, setLibelle] = useState(frais.libelle)
  const [montant, setMontant] = useState(String(frais.montant))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refApi.getAll('types-frais').then(t => setTypesFrais(t))
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
        <div className="flex justify-center mb-5">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-5">Modifier le frais</h3>

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
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Montant (€)</label>
            <input type="text" value={montant} onChange={e => setMontant(e.target.value)}
              inputMode="decimal"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !typeFraisId || !libelle.trim() || !montant}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-base active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-indigo-200">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </>
  )
}

// ─── Sheet ouvrir une nouvelle session ────────────────────────────────────────

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
      .catch(() => {})
      .finally(() => setLoadingPdv(false))
  }, [])

  async function ouvrir() {
    if (!pdvId) return
    setLoading(true)
    try {
      const s = await sessionsApi.open(parseInt(pdvId))
      onOuverte(s)
    } catch (err) {
      show(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const pdvSelectionne = listePdv.find(p => String(p.id) === pdvId)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl px-5 pt-5 pb-safe max-h-[85vh] flex flex-col">
        <div className="flex justify-center mb-4 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex-shrink-0">Nouvelle session</h3>

        <div className="flex-1 overflow-y-auto">
          {loadingPdv ? (
            <div className="py-8 text-center text-gray-400 text-sm">Chargement…</div>
          ) : listePdv.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Aucun point de vente configuré</p>
          ) : (
            <div className="space-y-2 mb-4">
              {listePdv.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPdvId(String(p.id))}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-98 text-left ${
                    pdvId === String(p.id) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    pdvId === String(p.id) ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}>
                    <svg className={`w-5 h-5 ${pdvId === String(p.id) ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
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

          <button
            onClick={() => setShowNouveauPdv(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-sm active:scale-95 transition-colors mb-4"
          >
            <span className="text-xl leading-none font-light">+</span>
            Nouveau point de vente
          </button>
        </div>

        <div className="flex gap-3 flex-shrink-0 pt-3">
          <button onClick={onClose} className="flex-1 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500">
            Annuler
          </button>
          <button
            onClick={ouvrir}
            disabled={!pdvId || loading}
            className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform"
          >
            {loading ? 'Ouverture…' : pdvSelectionne ? `Ouvrir — ${pdvSelectionne.nom}` : 'Ouvrir'}
          </button>
        </div>
      </div>

      {showNouveauPdv && (
        <NouveauPdvSheet
          typesPdv={typesPdv}
          onSave={async (data) => {
            try {
              const nvPdv = await pdvApi.create(data)
              setListePdv(prev => [...prev, nvPdv])
              setPdvId(String(nvPdv.id))
              setShowNouveauPdv(false)
              show('Point de vente créé !', 'success')
            } catch (err) {
              show(err.message, 'error')
            }
          }}
          onClose={() => setShowNouveauPdv(false)}
        />
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
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-5">Nouveau point de vente</h3>
        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom *</label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex : Salon du livre de Lyon"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
              autoFocus />
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
