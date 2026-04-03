import { useState, useEffect } from 'react'
import { pdv as pdvApi, sessions as sessionsApi, ref as refApi } from '../shared/api.js'
import { useSession } from '../shared/SessionContext.jsx'
import { useToast } from '../shared/toast.jsx'

export default function OuvrirSession() {
  const { ouvrirSession } = useSession()
  const { show } = useToast()
  const [listePdv, setListePdv] = useState([])
  const [pdvId, setPdvId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPdv, setLoadingPdv] = useState(true)
  const [showNouveauPdv, setShowNouveauPdv] = useState(false)
  const [typesPdv, setTypesPdv] = useState([])

  useEffect(() => {
    // Vérifier d'abord si une session est déjà ouverte sur le serveur
    sessionsApi.getAll({ limit: 20 })
      .then(liste => {
        const active = liste?.find(s => s.statut === 'ouverte')
        if (active) {
          // Session déjà ouverte → reconnecter silencieusement
          ouvrirSession(active)
          return
        }
        // Pas de session active → charger les PDV pour en ouvrir une
        return Promise.all([pdvApi.getAll(), refApi.getAll('types-pdv')])
          .then(([pdvs, types]) => {
            setListePdv(pdvs)
            setTypesPdv(types)
            if (pdvs.length === 1) setPdvId(String(pdvs[0].id))
          })
      })
      .catch(() => {
        // Erreur réseau → charger quand même les PDV
        Promise.all([pdvApi.getAll(), refApi.getAll('types-pdv')])
          .then(([pdvs, types]) => {
            setListePdv(pdvs)
            setTypesPdv(types)
            if (pdvs.length === 1) setPdvId(String(pdvs[0].id))
          })
          .catch(() => {})
      })
      .finally(() => setLoadingPdv(false))
  }, [])

  async function ouvrir() {
    if (!pdvId) return
    setLoading(true)
    try {
      const s = await sessionsApi.open(parseInt(pdvId))
      ouvrirSession(s)
      show('Session ouverte !', 'success')
    } catch (err) {
      show(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const pdvSelectionne = listePdv.find(p => String(p.id) === pdvId)

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Hero */}
      <div className="flex-shrink-0 bg-gradient-to-br from-indigo-600 to-violet-700 pt-safe px-6 pb-10">
        <div className="pt-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <span className="text-white text-3xl font-bold">E</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bonne journée !</h1>
          <p className="text-indigo-200 text-sm mt-1">Choisissez votre point de vente</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 -mt-4">
        <div className="bg-white rounded-3xl shadow-xl p-5 mb-4">

          {loadingPdv ? (
            <div className="py-8 text-center text-gray-400 text-sm">Chargement…</div>
          ) : listePdv.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-gray-400 text-sm mb-3">Aucun point de vente configuré</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {listePdv.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPdvId(String(p.id))}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-98 text-left ${
                    pdvId === String(p.id)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-100 bg-gray-50'
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

          {/* Bouton nouveau PDV */}
          <button
            onClick={() => setShowNouveauPdv(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-sm hover:border-indigo-300 hover:text-indigo-500 transition-colors active:scale-95"
          >
            <span className="text-xl leading-none font-light">+</span>
            Nouveau point de vente
          </button>
        </div>

        {/* Bouton ouvrir */}
        <button
          onClick={ouvrir}
          disabled={!pdvId || loading}
          className="w-full py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-base font-bold shadow-lg shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform mb-8"
        >
          {loading ? 'Ouverture en cours…' : pdvSelectionne ? `Ouvrir — ${pdvSelectionne.nom}` : 'Ouvrir la session'}
        </button>
      </div>

      {/* Sheet nouveau PDV */}
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
    </div>
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
      <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 shadow-2xl px-6 pt-5 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-5">Nouveau point de vente</h3>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom *</label>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex : Salon du livre de Lyon"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Type *</label>
            <select
              value={typePDVId}
              onChange={e => setTypePDVId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Sélectionner --</option>
              {typesPdv.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !nom.trim() || !typePDVId}
            className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-40"
          >
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  )
}
