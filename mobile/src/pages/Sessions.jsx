import { useState, useEffect } from 'react'
import { sessions as sessionsApi, frais as fraisApi, ref as refApi, ventes as ventesApi } from '../shared/api.js'
import { useSession } from '../shared/SessionContext.jsx'
import { useToast } from '../shared/toast.jsx'

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

  useEffect(() => { charger() }, [session?.id])

  async function charger() {
    setLoading(true)
    try {
      const liste = await sessionsApi.getAll({ limit: 50 })
      const ouvertes = liste.filter(s => s.statut === 'ouverte')
      setSessionsOuvertes(ouvertes)
      setHistorique(liste.filter(s => s.statut !== 'ouverte'))

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
        <h1 className="text-2xl font-bold text-white mt-1">Sessions</h1>
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
            <p className="text-gray-400 text-xs mt-1">Ouvrez une session depuis l'onglet Caisse</p>
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
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Historique</h2>
            <div className="space-y-3">
              {historique.map(s => (
                <SessionHistoriqueCard key={s.id} sessionId={s.id} />
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
    </div>
  )
}

// ─── Card session active (celle sélectionnée dans l'app) ─────────────────────

function SessionActiveCard({ session, onAnnulerVente, onCloture, onAjouterFrais }) {
  const [expanded, setExpanded] = useState(false)
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

      <div className="flex gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={() => setExpanded(!expanded)}
          className="flex-1 py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 active:scale-95 transition-transform">
          {expanded ? 'Masquer' : `Détail (${session.ventes?.length || 0})`}
        </button>
        <button onClick={onAjouterFrais}
          className="flex-1 py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 active:scale-95 transition-transform">
          + Frais
        </button>
        <button onClick={onCloture}
          className="flex-1 py-3 bg-red-50 rounded-xl text-sm font-bold text-red-600 active:scale-95 transition-transform">
          Clôturer
        </button>
      </div>

      {expanded && session.ventes?.length > 0 && (
        <div className="divide-y divide-gray-50">
          {[...session.ventes].reverse().map(v => (
            <VenteLigne key={v.id} vente={v} onAnnuler={() => onAnnulerVente(v.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card session ouverte non sélectionnée ───────────────────────────────────

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

function SessionHistoriqueCard({ sessionId }) {
  const [session, setSession] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  async function charger() {
    if (session) { setExpanded(!expanded); return }
    setLoading(true)
    try { const s = await sessionsApi.getById(sessionId); setSession(s); setExpanded(true) }
    finally { setLoading(false) }
  }

  const caTotal = session?.ventes?.filter(v => !v.annulee).reduce((s, v) => s + calcMontantVente(v), 0) || 0
  const nbVentes = session?.ventes?.filter(v => !v.annulee).length || 0

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button onClick={charger} className="w-full flex items-center justify-between px-5 py-4 text-left active:bg-gray-50 transition-colors">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{session?.pointDeVente?.nom || `Session #${sessionId}`}</p>
          {session && <p className="text-xs text-gray-400 mt-0.5">{dateHeure(session.debut)}</p>}
        </div>
        <div className="text-right">
          {session ? (
            <>
              <p className="font-bold text-indigo-600 text-sm">{eur(caTotal)}</p>
              <p className="text-xs text-gray-400">{nbVentes} vente{nbVentes > 1 ? 's' : ''}</p>
            </>
          ) : (
            <span className="text-xs text-gray-400 font-medium">{loading ? '…' : 'Voir'}</span>
          )}
        </div>
      </button>

      {expanded && session?.ventes?.filter(v => !v.annulee).length > 0 && (
        <div className="border-t border-gray-100">
          {session.ventes.filter(v => !v.annulee).map(v => {
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
            <span className="text-base font-extrabold text-indigo-700">{eur(caTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

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
