import { useState, useEffect } from 'react'
import { sessions as sessionsApi, frais as fraisApi, ref as refApi } from '../shared/api.js'
import { ventes as ventesApi } from '../shared/api.js'
import { useSession } from '../shared/SessionContext.jsx'
import { useToast } from '../shared/toast.jsx'

function eur(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
}

function dateHeure(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Sessions() {
  const { session, fermerSession } = useSession()
  const { show } = useToast()
  const [sessionActive, setSessionActive] = useState(null)
  const [historique, setHistorique] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCloture, setShowCloture] = useState(false)
  const [showFrais, setShowFrais] = useState(false)
  const [sessionOuverte, setSessionOuverte] = useState(null) // data détaillée

  useEffect(() => {
    charger()
  }, [session])

  async function charger() {
    setLoading(true)
    try {
      const liste = await sessionsApi.getAll({ limit: 30 })
      const active = liste.find(s => !s.cloture)
      const passees = liste.filter(s => s.cloture)

      if (active) {
        const detail = await sessionsApi.getById(active.id)
        setSessionActive(detail)
      } else {
        setSessionActive(null)
      }
      setHistorique(passees)
    } finally {
      setLoading(false)
    }
  }

  async function annulerVente(venteId) {
    try {
      await ventesApi.annuler(venteId)
      show('Vente annulée', 'success')
      charger()
    } catch (err) {
      show(`Erreur : ${err.message}`, 'error')
    }
  }

  async function cloturer() {
    if (!sessionActive) return
    try {
      await sessionsApi.cloturer(sessionActive.id)
      fermerSession()
      show('Session clôturée', 'success')
      setShowCloture(false)
      charger()
    } catch (err) {
      show(`Erreur : ${err.message}`, 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-sm">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-shrink-0 bg-white pt-safe px-4 py-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-800">Sessions</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Session active */}
        {sessionActive ? (
          <SessionActiveCard
            session={sessionActive}
            onAnnulerVente={annulerVente}
            onCloture={() => setShowCloture(true)}
            onAjouterFrais={() => setShowFrais(true)}
          />
        ) : (
          <div className="bg-gray-100 rounded-2xl px-4 py-4 text-center text-sm text-gray-400">
            Aucune session en cours
          </div>
        )}

        {/* Historique */}
        {historique.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Historique</h2>
            <div className="space-y-3">
              {historique.map(s => (
                <SessionHistoriqueCard key={s.id} sessionId={s.id} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal clôture */}
      {showCloture && sessionActive && (
        <CloturModal
          session={sessionActive}
          onConfirmer={cloturer}
          onAnnuler={() => setShowCloture(false)}
        />
      )}

      {/* Sheet ajout frais */}
      {showFrais && sessionActive && (
        <AjouterFraisSheet
          sessionId={sessionActive.id}
          onSave={async (data) => {
            try {
              await fraisApi.ajouterSession(sessionActive.id, data)
              show('Frais ajouté', 'success')
              setShowFrais(false)
              charger()
            } catch (err) {
              show(err.message, 'error')
            }
          }}
          onClose={() => setShowFrais(false)}
        />
      )}
    </div>
  )
}

// ─── Session active détaillée ─────────────────────────────────────────────────

function SessionActiveCard({ session, onAnnulerVente, onCloture, onAjouterFrais }) {
  const [expanded, setExpanded] = useState(false)

  const caTotal = session.ventes?.reduce((s, v) => v.annulee ? s : s + (v.montantTotal || 0), 0) || 0
  const nbVentes = session.ventes?.filter(v => !v.annulee).length || 0
  const totalFrais = session.frais?.reduce((s, f) => s + f.montant, 0) || 0

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header carte */}
      <div className="bg-indigo-600 px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-indigo-200 text-xs font-medium mb-0.5">Session ouverte</p>
            <p className="text-white font-bold text-base">{session.pointDeVente?.nom}</p>
            <p className="text-indigo-200 text-xs mt-0.5">{dateHeure(session.debut)}</p>
          </div>
          <div className="bg-green-400 rounded-full px-2.5 py-0.5">
            <span className="text-white text-xs font-bold">● Live</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        <Stat label="CA" value={eur(caTotal)} />
        <Stat label="Ventes" value={nbVentes} />
        <Stat label="Frais" value={eur(totalFrais)} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 active:scale-95 transition-transform"
        >
          {expanded ? 'Masquer' : `Détail (${session.ventes?.length || 0})`}
        </button>
        <button
          onClick={onAjouterFrais}
          className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 active:scale-95 transition-transform"
        >
          + Frais
        </button>
        <button
          onClick={onCloture}
          className="flex-1 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-600 active:scale-95 transition-transform"
        >
          Clôturer
        </button>
      </div>

      {/* Ventes détaillées */}
      {expanded && session.ventes?.length > 0 && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {[...session.ventes].reverse().map(v => (
            <VenteLigne key={v.id} vente={v} onAnnuler={() => onAnnulerVente(v.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-bold text-gray-800 text-sm mt-0.5">{value}</p>
    </div>
  )
}

function VenteLigne({ vente, onAnnuler }) {
  const [confirm, setConfirm] = useState(false)
  const montant = vente.montantTotal || vente.lignes?.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0) || 0

  return (
    <div className={`flex items-center justify-between px-4 py-3 ${vente.annulee ? 'opacity-40' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-sm">{eur(montant)}</span>
          {vente.annulee && <span className="text-xs text-red-500 font-medium">Annulée</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {vente.methodePaiement?.nom} · {new Date(vente.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {vente.lignes?.length > 0 && (
          <p className="text-xs text-gray-400">
            {vente.lignes.map(l => `${l.produit?.nom} ×${l.quantite}`).join(', ')}
          </p>
        )}
      </div>
      {!vente.annulee && (
        confirm ? (
          <div className="flex gap-1 ml-2">
            <button
              onClick={onAnnuler}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium"
            >Oui</button>
            <button
              onClick={() => setConfirm(false)}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs"
            >Non</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="ml-2 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium border border-red-100"
          >
            Annuler
          </button>
        )
      )}
    </div>
  )
}

// ─── Session historique (lazy load) ──────────────────────────────────────────

function SessionHistoriqueCard({ sessionId }) {
  const [session, setSession] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  async function charger() {
    if (session) { setExpanded(!expanded); return }
    setLoading(true)
    try {
      const s = await sessionsApi.getById(sessionId)
      setSession(s)
      setExpanded(true)
    } finally {
      setLoading(false)
    }
  }

  const caTotal = session?.ventes?.filter(v => !v.annulee).reduce((s, v) => s + (v.montantTotal || 0), 0) || 0
  const nbVentes = session?.ventes?.filter(v => !v.annulee).length || 0

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={charger}
        className="w-full flex items-center justify-between px-4 py-4 text-left"
      >
        <div>
          <p className="font-semibold text-gray-800 text-sm">{session?.pointDeVente?.nom || `Session #${sessionId}`}</p>
          {session && (
            <p className="text-xs text-gray-400 mt-0.5">{dateHeure(session.debut)} — {dateHeure(session.fin || session.cloture)}</p>
          )}
        </div>
        <div className="text-right">
          {session ? (
            <>
              <p className="font-bold text-gray-700 text-sm">{eur(caTotal)}</p>
              <p className="text-xs text-gray-400">{nbVentes} vente{nbVentes > 1 ? 's' : ''}</p>
            </>
          ) : (
            <span className="text-xs text-gray-400">{loading ? 'Chargement…' : 'Voir le détail'}</span>
          )}
        </div>
      </button>

      {expanded && session?.ventes?.length > 0 && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {session.ventes.filter(v => !v.annulee).map(v => {
            const montant = v.montantTotal || v.lignes?.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0) || 0
            return (
              <div key={v.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs text-gray-600">
                    {v.lignes?.map(l => `${l.produit?.nom} ×${l.quantite}`).join(', ')}
                  </p>
                  <p className="text-xs text-gray-400">{v.methodePaiement?.nom}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700">{eur(montant)}</span>
              </div>
            )
          })}
          {/* Récap */}
          <div className="bg-gray-50 px-4 py-3 flex justify-between">
            <span className="text-sm font-semibold text-gray-600">Total</span>
            <span className="text-sm font-bold text-indigo-600">{eur(caTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal clôture ─────────────────────────────────────────────────────────────

function CloturModal({ session, onConfirmer, onAnnuler }) {
  const caTotal = session.ventes?.filter(v => !v.annulee).reduce((s, v) => s + (v.montantTotal || 0), 0) || 0
  const nbVentes = session.ventes?.filter(v => !v.annulee).length || 0
  const totalFrais = session.frais?.reduce((s, f) => s + f.montant, 0) || 0
  const resultat = caTotal - totalFrais

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full shadow-2xl px-6 py-6 pb-safe">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Clôturer la session</h3>

        <div className="bg-gray-50 rounded-2xl p-4 space-y-2 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{nbVentes} vente{nbVentes > 1 ? 's'  : ''}</span>
            <span className="font-semibold text-gray-800">{eur(caTotal)}</span>
          </div>
          {totalFrais > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Frais</span>
              <span className="font-semibold text-red-600">− {eur(totalFrais)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
            <span className="text-gray-800">Résultat net</span>
            <span className={resultat >= 0 ? 'text-green-600' : 'text-red-600'}>{eur(resultat)}</span>
          </div>
        </div>

        <button
          onClick={onConfirmer}
          className="w-full py-4 bg-red-600 text-white rounded-2xl font-semibold text-base active:scale-95 transition-transform mb-3"
        >
          Clôturer définitivement
        </button>
        <button
          onClick={onAnnuler}
          className="w-full py-3 text-gray-500 text-sm"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ─── Sheet ajout frais ─────────────────────────────────────────────────────────

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
    await onSave({ typeFraisId: parseInt(typeFraisId), libelle: libelle.trim(), montant: parseFloat(montant) })
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl px-6 py-6 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-5">Ajouter un frais</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
            <select
              value={typeFraisId}
              onChange={e => setTypeFraisId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {typesFrais.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Libellé</label>
            <input
              type="text"
              value={libelle}
              onChange={e => setLibelle(e.target.value)}
              placeholder="Ex: Péage A7"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant (€)</label>
            <input
              type="number"
              value={montant}
              onChange={e => setMontant(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !typeFraisId || !libelle.trim() || !montant}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-base active:scale-95 transition-transform disabled:opacity-40"
          >
            {saving ? 'Ajout…' : 'Ajouter le frais'}
          </button>
        </div>
      </div>
    </>
  )
}
