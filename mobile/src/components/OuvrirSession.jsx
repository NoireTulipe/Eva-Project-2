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
  const [nouveauPdvNom, setNouveauPdvNom] = useState('')
  const [nouveauPdvType, setNouveauPdvType] = useState('')
  const [typesPdv, setTypesPdv] = useState([])
  const [savingPdv, setSavingPdv] = useState(false)

  useEffect(() => {
    Promise.all([
      pdvApi.getAll(),
      refApi.getAll('types-pdv')
    ]).then(([liste, types]) => {
      setListePdv(liste)
      setTypesPdv(types)
      if (liste.length === 1) setPdvId(String(liste[0].id))
    }).finally(() => setLoadingPdv(false))
  }, [])

  async function creerPdv() {
    if (!nouveauPdvNom.trim()) return
    setSavingPdv(true)
    try {
      const nvPdv = await pdvApi.create({ nom: nouveauPdvNom.trim(), typeId: nouveauPdvType || undefined })
      setListePdv(prev => [...prev, nvPdv])
      setPdvId(String(nvPdv.id))
      setNouveauPdvNom('')
      setShowNouveauPdv(false)
      show('Point de vente créé', 'success')
    } catch (err) {
      show(err.message, 'error')
    } finally {
      setSavingPdv(false)
    }
  }

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

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Logo / titre */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">E</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Ouvrir une session</h1>
          <p className="text-gray-500 mt-1 text-sm">Choisissez votre point de vente</p>
        </div>

        {loadingPdv ? (
          <div className="text-center text-gray-400 text-sm">Chargement…</div>
        ) : (
          <div className="space-y-4">
            {/* Sélecteur PDV */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Point de vente</label>
              <select
                value={pdvId}
                onChange={e => setPdvId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Sélectionner --</option>
                {listePdv.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>

            {/* Bouton nouveau PDV */}
            {!showNouveauPdv ? (
              <button
                onClick={() => setShowNouveauPdv(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-sm hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                <span className="text-lg">+</span>
                Nouveau point de vente
              </button>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Nouveau point de vente</p>
                <input
                  type="text"
                  value={nouveauPdvNom}
                  onChange={e => setNouveauPdvNom(e.target.value)}
                  placeholder="Nom (ex: Salon du livre de Lyon)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <select
                  value={nouveauPdvType}
                  onChange={e => setNouveauPdvType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Type (optionnel)</option>
                  {typesPdv.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={creerPdv}
                    disabled={savingPdv || !nouveauPdvNom.trim()}
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {savingPdv ? 'Création…' : 'Créer'}
                  </button>
                  <button
                    onClick={() => { setShowNouveauPdv(false); setNouveauPdvNom('') }}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Bouton ouvrir */}
            <button
              onClick={ouvrir}
              disabled={!pdvId || loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-base font-semibold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform mt-2"
            >
              {loading ? 'Ouverture…' : 'Ouvrir la session'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
