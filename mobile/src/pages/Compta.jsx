import { useState, useEffect, useCallback } from 'react'
import { compta as comptaApi, frais as fraisApi, pertes as pertesApi } from '../shared/api.js'
import { useToast } from '../shared/toast.jsx'

function eur(v) {
  const n = parseFloat(v)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(isNaN(n) ? 0 : n)
}

function dateStr(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function dateHeureStr(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function calcCASession(s) {
  return s.ventes?.filter(v => !v.annulee).reduce((acc, v) =>
    acc + (v.lignes?.reduce((a, l) => a + (parseFloat(l.prixUnitaire) || 0) * l.quantite * (1 - ((parseFloat(l.remise) || 0) / 100)), 0) || 0),
  0) || 0
}

function calcFraisSession(s) {
  return s.frais?.reduce((a, f) => a + (parseFloat(f.montant) || 0), 0) || 0
}

function calcCommissionSession(s, ca) {
  const fixe = parseFloat(s.pointDeVente?.commissionFixe) || 0
  const pct  = parseFloat(s.pointDeVente?.commissionPourcent) || 0
  return fixe + ca * (pct / 100)
}

// ─── Onglets ──────────────────────────────────────────────────────────────────

const ONGLETS = ['Bilan', 'Frais', 'Pertes']

// ─── Ligne de bilan ───────────────────────────────────────────────────────────

function LigneBilan({ label, value, couleur, highlight }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${highlight ? 'bg-indigo-50 rounded-xl' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <span className={`font-bold text-sm ${couleur}`}>{eur(value)}</span>
    </div>
  )
}

// ─── Onglet Bilan ─────────────────────────────────────────────────────────────

function OngletBilan({ debut, fin, onVoirSession }) {
  const { show } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const res = await comptaApi.getRecap({ debut: debut || undefined, fin: fin || undefined })
      setData(res)
    } catch (err) {
      show(`Erreur : ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [debut, fin])

  useEffect(() => { charger() }, [charger])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <p className="text-gray-400 text-sm">Chargement…</p>
    </div>
  )

  if (!data) return null

  const { recap, sessions } = data

  return (
    <div className="space-y-4">
      {/* Carte bilan */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Résumé période</p>
          <p className="text-xs text-gray-400 mt-0.5">{recap.nbSessions} session{recap.nbSessions !== 1 ? 's' : ''} clôturée{recap.nbSessions !== 1 ? 's' : ''}</p>
        </div>
        <div className="divide-y divide-gray-50">
          <LigneBilan label="Chiffre d'affaires" value={recap.totalCA} couleur="text-emerald-600" />
          <LigneBilan label="Commissions PDV"    value={-recap.totalCommissionPDV} couleur="text-red-500" />
          <LigneBilan label="Droits auteur"       value={-recap.totalDroitsAuteur} couleur="text-red-500" />
          <LigneBilan label="Frais"               value={-recap.totalFrais} couleur="text-red-500" />
          <LigneBilan label="Pertes"              value={-recap.totalPertes} couleur="text-red-500" />
          <LigneBilan label="Résultat net"        value={recap.beneficeNet}
            couleur={recap.beneficeNet >= 0 ? 'text-indigo-700' : 'text-red-700'} highlight />
        </div>
      </div>

      {/* Détail par session */}
      {sessions?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Détail par session</p>
          <div className="space-y-2">
            {sessions.map(s => {
              const ca = calcCASession(s)
              const fraisS = calcFraisSession(s)
              const commission = calcCommissionSession(s, ca)
              const net = ca - commission - fraisS
              return (
                <button
                  key={s.id}
                  onClick={() => onVoirSession(s)}
                  className="w-full bg-white rounded-2xl shadow-sm px-4 py-4 text-left active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{s.pointDeVente?.nom || `Session #${s.id}`}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{dateHeureStr(s.debut)}</p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="font-bold text-emerald-600 text-sm">{eur(ca)}</p>
                      <p className={`text-xs font-semibold mt-0.5 ${net >= 0 ? 'text-indigo-500' : 'text-red-500'}`}>
                        net {eur(net)}
                      </p>
                    </div>
                  </div>
                  {(commission > 0 || fraisS > 0) && (
                    <div className="flex gap-3 mt-2">
                      {commission > 0 && (
                        <span className="text-xs text-red-400">commission {eur(commission)}</span>
                      )}
                      {fraisS > 0 && (
                        <span className="text-xs text-red-400">frais {eur(fraisS)}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-end mt-1">
                    <span className="text-xs text-indigo-400 font-medium">Voir détail →</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sessions?.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm px-5 py-8 text-center">
          <p className="text-gray-400 text-sm">Aucune session sur cette période</p>
        </div>
      )}
    </div>
  )
}

// ─── Onglet Frais ─────────────────────────────────────────────────────────────

function OngletFrais({ debut, fin }) {
  const { show } = useToast()
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fraisApi.getAll({ debut: debut || undefined, fin: fin || undefined })
      setListe(res || [])
    } catch (err) {
      show(`Erreur : ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [debut, fin])

  useEffect(() => { charger() }, [charger])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <p className="text-gray-400 text-sm">Chargement…</p>
    </div>
  )

  const total = liste.reduce((a, f) => a + (parseFloat(f.montant) || 0), 0)

  return (
    <div className="space-y-3">
      {/* Récap */}
      <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">{liste.length} frais</span>
        <span className="font-bold text-red-500">{eur(total)}</span>
      </div>

      {liste.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm px-5 py-8 text-center">
          <p className="text-gray-400 text-sm">Aucun frais sur cette période</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {liste.map(f => (
            <div key={f.id} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{f.libelle}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {f.typeFrais?.nom} · {dateStr(f.createdAt)}
                  </p>
                  {f.session && (
                    <p className="text-xs text-indigo-400 mt-0.5">{f.session.pointDeVente?.nom}</p>
                  )}
                  {!f.session && (
                    <p className="text-xs text-gray-300 mt-0.5">Hors session</p>
                  )}
                </div>
                <span className="font-bold text-red-500 text-sm ml-3 flex-shrink-0">{eur(f.montant)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Pertes ────────────────────────────────────────────────────────────

function OngletPertes({ debut, fin }) {
  const { show } = useToast()
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pertesApi.getAll({ debut: debut || undefined, fin: fin || undefined })
      setListe(res || [])
    } catch (err) {
      show(`Erreur : ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [debut, fin])

  useEffect(() => { charger() }, [charger])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <p className="text-gray-400 text-sm">Chargement…</p>
    </div>
  )

  const total = liste.reduce((a, p) => a + (parseFloat(p.valeur) || 0), 0)

  return (
    <div className="space-y-3">
      {/* Récap */}
      <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">{liste.length} perte{liste.length !== 1 ? 's' : ''}</span>
        <span className="font-bold text-red-500">{eur(total)}</span>
      </div>

      {liste.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm px-5 py-8 text-center">
          <p className="text-gray-400 text-sm">Aucune perte sur cette période</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {liste.map(p => (
            <div key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{p.typePerte?.nom || '—'}</p>
                  {p.produit && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.produit.nom}{p.quantite ? ` ×${p.quantite}` : ''}
                    </p>
                  )}
                  {p.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{p.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{dateStr(p.createdAt)}</p>
                </div>
                <span className="font-bold text-red-500 text-sm ml-3 flex-shrink-0">{eur(p.valeur)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sheet détail d'une session ───────────────────────────────────────────────

function SessionDetailSheet({ session, onClose }) {
  const ca = calcCASession(session)
  const fraisS = calcFraisSession(session)
  const commission = calcCommissionSession(session, ca)
  const droitsAuteur = session.ventes?.filter(v => !v.annulee).reduce((acc, v) =>
    acc + (v.lignes?.reduce((a, l) => {
      const droits = parseFloat(l.produit?.droitsAuteur) || 0
      const montant = (parseFloat(l.prixUnitaire) || 0) * l.quantite * (1 - ((parseFloat(l.remise) || 0) / 100))
      return a + montant * (droits / 100)
    }, 0) || 0), 0) || 0
  const net = ca - commission - droitsAuteur - fraisS

  const ventesActives = session.ventes?.filter(v => !v.annulee) || []

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-slate-50 rounded-t-3xl z-50 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Handle */}
        <div className="flex justify-center pt-4 pb-2 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Comptabilité session</p>
              <p className="text-lg font-bold text-gray-800">{session.pointDeVente?.nom}</p>
              <p className="text-xs text-gray-400">{dateHeureStr(session.debut)}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center active:scale-95">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-safe space-y-4">
          {/* Bilan session */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bilan</p>
            </div>
            <div className="divide-y divide-gray-50">
              <LigneBilan label="Chiffre d'affaires" value={ca} couleur="text-emerald-600" />
              {commission > 0 && <LigneBilan label="Commission PDV"  value={-commission} couleur="text-red-500" />}
              {droitsAuteur > 0 && <LigneBilan label="Droits auteur" value={-droitsAuteur} couleur="text-red-500" />}
              {fraisS > 0 && <LigneBilan label="Frais"               value={-fraisS} couleur="text-red-500" />}
              <LigneBilan label="Résultat net" value={net}
                couleur={net >= 0 ? 'text-indigo-700' : 'text-red-700'} highlight />
            </div>
          </div>

          {/* Ventes */}
          {ventesActives.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
                Ventes ({ventesActives.length})
              </p>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
                {ventesActives.map(v => {
                  const montant = v.lignes?.reduce((a, l) =>
                    a + (parseFloat(l.prixUnitaire) || 0) * l.quantite * (1 - ((parseFloat(l.remise) || 0) / 100)), 0) || 0
                  return (
                    <div key={v.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {v.lignes?.map(l => `${l.produit?.nom} ×${l.quantite}`).join(', ') || '—'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {v.methodePaiement?.nom} · {new Date(v.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className="font-bold text-gray-800 text-sm ml-3 flex-shrink-0">{eur(montant)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Frais de session */}
          {session.frais?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
                Frais ({session.frais.length})
              </p>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
                {session.frais.map(f => (
                  <div key={f.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{f.libelle}</p>
                      <p className="text-xs text-gray-400">{f.typeFrais?.nom}</p>
                    </div>
                    <span className="font-bold text-red-500 text-sm">{eur(f.montant)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Compta() {
  const [onglet, setOnglet] = useState(0)
  const now = new Date()
  const [debut, setDebut] = useState(`${now.getFullYear()}-01-01`)
  const [fin, setFin] = useState('')
  const [showFiltres, setShowFiltres] = useState(false)
  const [sessionSelectionnee, setSessionSelectionnee] = useState(null)

  const labelPeriode = () => {
    if (!debut && !fin) return 'Toute la période'
    if (debut && fin) return `${dateStr(debut)} → ${dateStr(fin)}`
    if (debut) return `Depuis le ${dateStr(debut)}`
    return `Jusqu'au ${dateStr(fin)}`
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-teal-700 pt-safe px-4 pb-5">
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-2xl font-bold text-white">Comptabilité</h1>
          <button
            onClick={() => setShowFiltres(true)}
            className="flex items-center gap-1.5 bg-white/20 text-white text-sm font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Période
          </button>
        </div>
        {/* Badge période */}
        <div className="mt-2">
          <span className="text-emerald-200 text-xs font-medium">{labelPeriode()}</span>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 flex">
        {ONGLETS.map((o, i) => (
          <button
            key={o}
            onClick={() => setOnglet(i)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              onglet === i ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {onglet === 0 && <OngletBilan debut={debut} fin={fin} onVoirSession={setSessionSelectionnee} />}
        {onglet === 1 && <OngletFrais debut={debut} fin={fin} />}
        {onglet === 2 && <OngletPertes debut={debut} fin={fin} />}
      </div>

      {/* Sheet filtres période */}
      {showFiltres && (
        <FiltrePeriodeSheet
          debut={debut}
          fin={fin}
          onApply={(d, f) => { setDebut(d); setFin(f); setShowFiltres(false) }}
          onClose={() => setShowFiltres(false)}
        />
      )}

      {/* Sheet détail session */}
      {sessionSelectionnee && (
        <SessionDetailSheet
          session={sessionSelectionnee}
          onClose={() => setSessionSelectionnee(null)}
        />
      )}
    </div>
  )
}

// ─── Sheet filtres période ────────────────────────────────────────────────────

function FiltrePeriodeSheet({ debut, fin, onApply, onClose }) {
  const [d, setD] = useState(debut)
  const [f, setF] = useState(fin)
  const now = new Date()

  function preset(key) {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    if (key === 'annee')    { setD(`${y}-01-01`);                        setF('') }
    if (key === 'mois')     { setD(`${y}-${m}-01`);                      setF('') }
    if (key === 'tout')     { setD('');                                   setF('') }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl px-5 pt-5 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Filtrer la période</h3>

        {/* Presets */}
        <div className="flex gap-2 mb-5">
          {[
            { label: 'Cette année', key: 'annee' },
            { label: 'Ce mois',     key: 'mois' },
            { label: 'Tout',        key: 'tout' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => preset(p.key)}
              className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600 active:scale-95 transition-transform"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Du</label>
            <input
              type="date"
              value={d}
              onChange={e => setD(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Au</label>
            <input
              type="date"
              value={f}
              onChange={e => setF(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500">
            Annuler
          </button>
          <button
            onClick={() => onApply(d, f)}
            className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform"
          >
            Appliquer
          </button>
        </div>
      </div>
    </>
  )
}
