import { useState } from 'react'
import { useApi } from '../../../shared/hooks/useApi.js'
import { produits, pdv, ventes, sessions } from '../../../shared/api.js'
import { useSession } from '../../../shared/SessionContext.jsx'
import Spinner from '../../../components/web/Spinner.jsx'
import ErrorMessage from '../../../components/web/ErrorMessage.jsx'
import SelectRef from '../../../components/web/SelectRef.jsx'

const EUR = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const DATE = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

// ─── Vue : ouvrir une nouvelle session ────────────────────────────────────────

function VueOuvrirSession({ onOuverte }) {
  const { data: listePDV, loading } = useApi(() => pdv.getAll())
  const [form, setForm] = useState({ pointDeVenteId: '', debut: new Date().toISOString().slice(0, 16) })
  const [error, setError] = useState(null)
  const [opening, setOpening] = useState(false)
  const { ouvrirSession } = useSession()

  async function handleSubmit(e) {
    e.preventDefault()
    setOpening(true)
    setError(null)
    try {
      await ouvrirSession(Number(form.pointDeVenteId), new Date(form.debut).toISOString())
    } catch (err) {
      setError(err.message)
    } finally {
      setOpening(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-md">
      <h2 className="font-semibold text-gray-800 mb-4">Ouvrir une session de vente</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Point de vente *</label>
          <select
            value={form.pointDeVenteId}
            onChange={e => setForm(f => ({ ...f, pointDeVenteId: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">-- Choisir --</option>
            {listePDV?.map(p => (
              <option key={p.id} value={p.id}>{p.nom}{p.ville ? ` — ${p.ville}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de début</label>
          <input
            type="datetime-local"
            value={form.debut}
            onChange={e => setForm(f => ({ ...f, debut: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <ErrorMessage message={error} />
        <button type="submit" disabled={opening}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm">
          {opening ? 'Ouverture...' : 'Ouvrir la session'}
        </button>
      </form>
    </div>
  )
}

// ─── Vue : session active ──────────────────────────────────────────────────────

function VueSessionActive() {
  const { session, rechargerSession, cloturerSession } = useSession()
  const { data: listeProduits } = useApi(() => produits.getAll())

  const [venteForm, setVenteForm] = useState({ produitId: '', quantite: 1, prixUnitaire: '', remise: 0, methodePaiementId: '' })
  const [venteError, setVenteError] = useState(null)
  const [venteLoading, setVenteLoading] = useState(false)
  const [recap, setRecap] = useState(null)
  const [cloturing, setCloturing] = useState(false)

  function handleProduitChange(e) {
    const id = e.target.value
    const produit = listeProduits?.find(p => String(p.id) === id)
    setVenteForm(f => ({ ...f, produitId: id, prixUnitaire: produit ? produit.prixVenteTTC : '' }))
  }

  async function handleEnregistrerVente(e) {
    e.preventDefault()
    setVenteLoading(true)
    setVenteError(null)
    try {
      await ventes.enregistrer({
        sessionId: session.id,
        methodePaiementId: Number(venteForm.methodePaiementId),
        type: 'directe',
        lignes: [{
          produitId: Number(venteForm.produitId),
          quantite: Number(venteForm.quantite),
          prixUnitaire: Number(venteForm.prixUnitaire),
          remise: Number(venteForm.remise)
        }]
      })
      setVenteForm(f => ({ ...f, produitId: '', quantite: 1, prixUnitaire: '', remise: 0 }))
      await rechargerSession()
    } catch (err) {
      setVenteError(err.message)
    } finally {
      setVenteLoading(false)
    }
  }

  async function handleAnnulerVente(id) {
    try {
      await ventes.annuler(id)
      await rechargerSession()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleCloturer() {
    setCloturing(true)
    try {
      const { recap: r } = await cloturerSession()
      setRecap(r)
    } catch (err) {
      alert(err.message)
    } finally {
      setCloturing(false)
    }
  }

  // Après clôture, session est null dans le contexte — on affiche le récap ici avant reset
  if (recap) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <h2 className="font-semibold text-green-800 mb-1">Session clôturée</h2>
          <p className="text-sm text-green-700">La session a été fermée avec succès.</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Récapitulatif financier</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'CA total', value: recap.ca },
              { label: 'Commission PDV', value: recap.commissionPDV },
              { label: 'Droits auteur', value: recap.droitsAuteur },
              { label: 'Frais', value: recap.totalFrais },
              { label: 'Bénéfice net', value: recap.beneficeNet, highlight: true }
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`rounded p-3 ${highlight ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`font-semibold ${highlight ? 'text-blue-700' : 'text-gray-800'}`}>{value != null ? EUR(value) : '—'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const ventesActives = session.ventes?.filter(v => !v.annulee) ?? []

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-lg shadow p-5 flex justify-between items-start">
        <div>
          <h2 className="font-semibold text-gray-800 text-lg">{session.pointDeVente?.nom}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Ouverte le {DATE(session.debut)}</p>
          <p className="text-sm font-medium text-green-700 mt-1">
            {ventesActives.length} vente{ventesActives.length !== 1 ? 's' : ''} — CA provisoire :{' '}
            {EUR(ventesActives.reduce((acc, v) =>
              acc + v.lignes.reduce((a, l) => a + l.prixUnitaire * l.quantite * (1 - (l.remise || 0) / 100), 0), 0
            ))}
          </p>
        </div>
        <button
          onClick={handleCloturer}
          disabled={cloturing}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm"
        >
          {cloturing ? 'Clôture...' : 'Clôturer la session'}
        </button>
      </div>

      {/* Formulaire vente */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="font-medium text-gray-700 mb-4">Enregistrer une vente</h3>
        <form onSubmit={handleEnregistrerVente} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Produit *</label>
            <select value={venteForm.produitId} onChange={handleProduitChange} required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">-- Choisir --</option>
              {listeProduits?.map(p => (
                <option key={p.id} value={p.id}>{p.nom} (stock : {p.stock})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
            <input type="number" min="1" value={venteForm.quantite}
              onChange={e => setVenteForm(f => ({ ...f, quantite: e.target.value }))}
              required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire (€) *</label>
            <input type="number" step="0.01" value={venteForm.prixUnitaire}
              onChange={e => setVenteForm(f => ({ ...f, prixUnitaire: e.target.value }))}
              required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remise (%)</label>
            <input type="number" step="0.1" min="0" max="100" value={venteForm.remise}
              onChange={e => setVenteForm(f => ({ ...f, remise: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de paiement *</label>
            <SelectRef table="methodes-paiement" label="Paiement"
              value={venteForm.methodePaiementId}
              onChange={v => setVenteForm(f => ({ ...f, methodePaiementId: v }))}
              required />
          </div>
          <div className="col-span-2 md:col-span-4 flex gap-2 items-start">
            <ErrorMessage message={venteError} />
            <button type="submit" disabled={venteLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm ml-auto">
              {venteLoading ? 'Enregistrement...' : 'Enregistrer la vente'}
            </button>
          </div>
        </form>
      </div>

      {/* Liste ventes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-medium text-gray-700">Ventes de la session</h3>
          <span className="text-xs text-gray-400">{session.ventes?.length ?? 0} enregistrement(s)</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Produit</th>
              <th className="px-4 py-3 font-medium text-gray-600">Qté</th>
              <th className="px-4 py-3 font-medium text-gray-600">Prix unit.</th>
              <th className="px-4 py-3 font-medium text-gray-600">Remise</th>
              <th className="px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 font-medium text-gray-600">Paiement</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {session.ventes?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Aucune vente</td></tr>
            )}
            {session.ventes?.map(v =>
              v.lignes?.map((l, i) => (
                <tr key={`${v.id}-${i}`}
                  className={`border-b border-gray-100 ${v.annulee ? 'opacity-40 line-through' : ''}`}>
                  <td className="px-4 py-3">{l.produit?.nom ?? `#${l.produitId}`}</td>
                  <td className="px-4 py-3">{l.quantite}</td>
                  <td className="px-4 py-3">{EUR(l.prixUnitaire)}</td>
                  <td className="px-4 py-3">{l.remise ? `${l.remise}%` : '—'}</td>
                  <td className="px-4 py-3 font-medium">
                    {EUR(l.prixUnitaire * l.quantite * (1 - (l.remise || 0) / 100))}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{v.methodePaiement?.nom ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {!v.annulee && (
                      <button onClick={() => handleAnnulerVente(v.id)}
                        className="text-red-500 hover:underline text-xs">Annuler</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Vue : historique des sessions ────────────────────────────────────────────

function VueHistorique() {
  const { data: historique, loading, error } = useApi(() => sessions.getAll({ limit: 50 }))
  const [expanded, setExpanded] = useState(null)

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">
        Historique des sessions ({historique?.length ?? 0})
      </h2>
      {historique?.length === 0 && (
        <p className="text-gray-400 text-sm">Aucune session enregistrée.</p>
      )}
      <div className="space-y-2">
        {historique?.map(s => {
          const ventesActives = s.ventes?.filter(v => !v.annulee) ?? []
          const ca = ventesActives.reduce((acc, v) =>
            acc + v.lignes.reduce((a, l) => a + l.prixUnitaire * l.quantite * (1 - (l.remise || 0) / 100), 0), 0
          )
          const isOpen = expanded === s.id

          return (
            <div key={s.id} className="bg-white rounded-lg shadow overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.statut === 'ouverte' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {s.statut}
                  </span>
                  <span className="font-medium text-gray-800">{s.pointDeVente?.nom}</span>
                  <span className="text-sm text-gray-500">{DATE(s.debut)}</span>
                  {s.fin && <span className="text-sm text-gray-400">→ {DATE(s.fin)}</span>}
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-500">{ventesActives.length} vente(s)</span>
                  <span className="font-semibold text-gray-800">{EUR(ca)}</span>
                  <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 font-medium text-gray-500">Produit</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Qté</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Prix unit.</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Total</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.ventes?.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400">Aucune vente</td></tr>
                      )}
                      {s.ventes?.map(v =>
                        v.lignes?.map((l, i) => (
                          <tr key={`${v.id}-${i}`}
                            className={`border-b border-gray-100 ${v.annulee ? 'opacity-40 line-through' : ''}`}>
                            <td className="px-4 py-2">{l.produit?.nom ?? `#${l.produitId}`}</td>
                            <td className="px-4 py-2">{l.quantite}</td>
                            <td className="px-4 py-2">{EUR(l.prixUnitaire)}</td>
                            <td className="px-4 py-2">{EUR(l.prixUnitaire * l.quantite * (1 - (l.remise || 0) / 100))}</td>
                            <td className="px-4 py-2">{v.annulee ? 'Annulée' : 'OK'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

const VUES = ['Session active', 'Historique']

export default function Ventes() {
  const { session, loadingSession } = useSession()
  const [vue, setVue] = useState(0)

  if (loadingSession) return <Spinner />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Ventes</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {VUES.map((v, i) => (
          <button key={v} onClick={() => setVue(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              vue === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {v}
            {v === 'Session active' && session && (
              <span className="ml-2 w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
            )}
          </button>
        ))}
      </div>

      {vue === 0 && (session ? <VueSessionActive /> : <VueOuvrirSession />)}
      {vue === 1 && <VueHistorique />}
    </div>
  )
}
