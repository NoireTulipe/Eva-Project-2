import { useState } from 'react'
import { useApi } from '../../../shared/hooks/useApi.js'
import { depots, produits, pdv } from '../../../shared/api.js'
import Spinner from '../../../components/web/Spinner.jsx'
import ErrorMessage from '../../../components/web/ErrorMessage.jsx'

const DATE = d => new Date(d).toLocaleDateString('fr-FR', { dateStyle: 'short' })

// ─── Formulaire nouveau dépôt ─────────────────────────────────────────────────

function FormulaireDepot({ listeProduits, listePDV, onCreer, onAnnuler }) {
  const [form, setForm] = useState({ produitId: '', pointDeVenteId: '', quantite: '', notes: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await depots.create({
        produitId: Number(form.produitId),
        pointDeVenteId: Number(form.pointDeVenteId),
        quantite: Number(form.quantite),
        notes: form.notes || undefined,
      })
      onCreer()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="font-medium mb-4">Nouveau dépôt</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Produit *</label>
          <select name="produitId" value={form.produitId} onChange={handleChange} required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">-- Choisir --</option>
            {listeProduits?.map(p => (
              <option key={p.id} value={p.id}>{p.nom} (stock dispo : {p.stock})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Point de vente *</label>
          <select name="pointDeVenteId" value={form.pointDeVenteId} onChange={handleChange} required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">-- Choisir --</option>
            {listePDV?.map(p => (
              <option key={p.id} value={p.id}>{p.nom}{p.ville ? ` — ${p.ville}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
          <input name="quantite" type="number" min="1" value={form.quantite} onChange={handleChange}
            required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <input name="notes" value={form.notes} onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <ErrorMessage message={error} />
        <div className="col-span-2 flex gap-2 justify-end">
          <button type="button" onClick={onAnnuler}
            className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm">
            {saving ? 'Enregistrement...' : 'Créer le dépôt'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Modale retour ────────────────────────────────────────────────────────────

function ModaleRetour({ depot, onRetour, onAnnuler }) {
  const [quantite, setQuantite] = useState(depot.quantite)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const q = Number(quantite)
    if (q <= 0 || q > depot.quantite) {
      setError(`Quantité invalide (max : ${depot.quantite})`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await depots.retour(depot.id, q)
      onRetour()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-800 mb-1">Retour de dépôt</h3>
        <p className="text-sm text-gray-500 mb-4">
          {depot.produit?.nom} chez {depot.pointDeVente?.nom}<br />
          Quantité en dépôt : <strong>{depot.quantite}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantité retournée *</label>
            <input type="number" min="1" max={depot.quantite} value={quantite}
              onChange={e => setQuantite(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          {error && <ErrorMessage message={error} />}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onAnnuler}
              className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm">
              {saving ? '...' : 'Confirmer le retour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function Depots() {
  const { data: liste, loading, error, refetch } = useApi(() => depots.getAll())
  const { data: listeProduits } = useApi(() => produits.getAll())
  const { data: listePDV } = useApi(() => pdv.getAll())

  const [showForm, setShowForm] = useState(false)
  const [depotRetour, setDepotRetour] = useState(null)
  const [filtrePDV, setFiltrePDV] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('actif')

  function handleCreer() {
    setShowForm(false)
    refetch()
  }

  function handleRetour() {
    setDepotRetour(null)
    refetch()
  }

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  const listeFiltree = liste?.filter(d => {
    if (filtrePDV && String(d.pointDeVenteId) !== filtrePDV) return false
    if (filtreStatut === 'actif' && !d.actif) return false
    if (filtreStatut === 'cloture' && d.actif) return false
    return true
  }) ?? []

  // Regrouper par PDV
  const parPDV = listeFiltree.reduce((acc, d) => {
    const key = d.pointDeVenteId
    if (!acc[key]) acc[key] = { pdv: d.pointDeVente, depots: [] }
    acc[key].depots.push(d)
    return acc
  }, {})

  return (
    <div>
      {depotRetour && (
        <ModaleRetour
          depot={depotRetour}
          onRetour={handleRetour}
          onAnnuler={() => setDepotRetour(null)}
        />
      )}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Dépôts PDV</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
          + Nouveau dépôt
        </button>
      </div>

      {showForm && (
        <FormulaireDepot
          listeProduits={listeProduits}
          listePDV={listePDV}
          onCreer={handleCreer}
          onAnnuler={() => setShowForm(false)}
        />
      )}

      {/* Filtres */}
      <div className="flex gap-3 mb-4 items-center">
        <select value={filtrePDV} onChange={e => setFiltrePDV(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="">Tous les PDV</option>
          {listePDV?.map(p => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="actif">Dépôts actifs</option>
          <option value="cloture">Dépôts clôturés</option>
          <option value="">Tous</option>
        </select>
        <span className="text-sm text-gray-400">{listeFiltree.length} dépôt(s)</span>
      </div>

      {listeFiltree.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400 text-sm">
          Aucun dépôt{filtreStatut === 'actif' ? ' actif' : ''}.
        </div>
      )}

      {/* Par PDV */}
      <div className="space-y-6">
        {Object.values(parPDV).map(({ pdv: p, depots: listeDepots }) => {
          const totalExemplaires = listeDepots.filter(d => d.actif).reduce((a, d) => a + d.quantite, 0)
          return (
            <div key={p?.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-gray-800">{p?.nom ?? 'PDV inconnu'}</h2>
                  {p?.ville && <p className="text-xs text-gray-500">{p.ville}</p>}
                </div>
                {filtreStatut !== 'cloture' && (
                  <span className="text-sm font-medium text-blue-700">
                    {totalExemplaires} exemplaire{totalExemplaires !== 1 ? 's' : ''} en dépôt
                  </span>
                )}
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">Produit</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center">Qté déposée</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Date dépôt</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Date retour</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Notes</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center">Statut</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {listeDepots.map(d => (
                    <tr key={d.id} className={`border-b border-gray-100 ${!d.actif ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{d.produit?.nom ?? `#${d.produitId}`}</td>
                      <td className="px-4 py-3 text-center">{d.quantite}</td>
                      <td className="px-4 py-3 text-gray-500">{DATE(d.dateDepot)}</td>
                      <td className="px-4 py-3 text-gray-400">{d.dateRetour ? DATE(d.dateRetour) : '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.notes ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          d.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {d.actif ? 'Actif' : 'Clôturé'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {d.actif && (
                          <button onClick={() => setDepotRetour(d)}
                            className="text-orange-600 hover:underline text-xs">
                            Retour
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
