import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../../../shared/hooks/useApi.js'
import { produits, pdv, ventes, sessions, frais } from '../../../shared/api.js'
import { useSession } from '../../../shared/SessionContext.jsx'
import Spinner from '../../../components/web/Spinner.jsx'
import ErrorMessage from '../../../components/web/ErrorMessage.jsx'
import SelectRef from '../../../components/web/SelectRef.jsx'

const EUR = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const DATE = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

// ─── Vue : ouvrir une nouvelle session ────────────────────────────────────────

function VueOuvrirSession({ onSessionOuverte }) {
  const { data: listePDV, loading } = useApi(() => pdv.getAll())
  const [form, setForm] = useState({ pointDeVenteId: '', debut: new Date().toISOString().slice(0, 16) })
  const [error, setError] = useState(null)
  const [opening, setOpening] = useState(false)
  const { ouvrirSession, changerSession } = useSession()

  async function handleSubmit(e) {
    e.preventDefault()
    setOpening(true)
    setError(null)
    try {
      const s = await ouvrirSession(Number(form.pointDeVenteId), new Date(form.debut).toISOString())
      changerSession(s)
      if (onSessionOuverte) onSessionOuverte(s.id)
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

// ─── Sous-vue : frais d'une session ───────────────────────────────────────────

function VueFraisSession({ sessionId, fraisList, onRefresh }) {
  const [form, setForm] = useState({ typeFraisId: '', libelle: '', montant: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleAjouter(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await frais.ajouterSession(sessionId, {
        typeFraisId: Number(form.typeFraisId),
        libelle: form.libelle,
        montant: Number(form.montant),
      })
      setForm({ typeFraisId: '', libelle: '', montant: '' })
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSupprimer(id) {
    try {
      await frais.remove(id)
      onRefresh()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="font-medium text-gray-700 mb-4">Frais de la session</h3>
      <form onSubmit={handleAjouter} className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <SelectRef table="types-frais" label="Type de frais"
            value={form.typeFraisId}
            onChange={v => setForm(f => ({ ...f, typeFraisId: v }))}
            required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
          <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
            required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€) *</label>
          <div className="flex gap-2">
            <input type="number" step="0.01" min="0" value={form.montant}
              onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
              required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm whitespace-nowrap">
              {saving ? '...' : '+ Ajouter'}
            </button>
          </div>
        </div>
        {error && <div className="col-span-3"><ErrorMessage message={error} /></div>}
      </form>

      {fraisList?.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Libellé</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Montant</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fraisList.map(f => (
              <tr key={f.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-500">{f.typeFrais?.nom ?? '—'}</td>
                <td className="px-3 py-2">{f.libelle}</td>
                <td className="px-3 py-2 text-right font-medium">{EUR(f.montant)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => handleSupprimer(f.id)} className="text-red-500 hover:underline text-xs">Supprimer</button>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200">
              <td colSpan={2} className="px-3 py-2 font-medium text-gray-700">Total frais</td>
              <td className="px-3 py-2 text-right font-semibold">{EUR(fraisList.reduce((a, f) => a + f.montant, 0))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-400">Aucun frais enregistré.</p>
      )}
    </div>
  )
}

// ─── Composant récap financier réutilisable ───────────────────────────────────

function RecapFinancier({ recap }) {
  const lignes = [
    { label: 'CA total', value: recap.ca },
    { label: 'Commission PDV', value: recap.commissionPDV, negatif: true },
    { label: 'Droits auteur', value: recap.droitsAuteur, negatif: true },
    { label: 'Frais', value: recap.totalFrais, negatif: true },
    { label: 'Bénéfice net', value: recap.beneficeNet, highlight: true },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {lignes.map(({ label, value, highlight, negatif }) => (
        <div key={label} className={`rounded p-3 ${highlight ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`font-semibold ${highlight ? 'text-blue-700' : negatif ? 'text-red-600' : 'text-gray-800'}`}>
            {value != null ? EUR(value) : '—'}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Vue : détail d'une session active ────────────────────────────────────────

function VueDetailSession({ sessionId, onRetour }) {
  const { session: contextSession, changerSession } = useSession()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { data: listeProduits } = useApi(() => produits.getAll())

  const [venteForm, setVenteForm] = useState({ produitId: '', quantite: 1, prixUnitaire: '', remise: 0, methodePaiementId: '' })
  const [venteError, setVenteError] = useState(null)
  const [venteLoading, setVenteLoading] = useState(false)
  const [recap, setRecap] = useState(null)
  const [cloturing, setCloturing] = useState(false)

  const charger = useCallback(async () => {
    try {
      setLoading(true)
      const s = await sessions.getById(sessionId)
      setSession(s)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { charger() }, [charger])

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
      await charger()
    } catch (err) {
      setVenteError(err.message)
    } finally {
      setVenteLoading(false)
    }
  }

  async function handleAnnulerVente(id) {
    try {
      await ventes.annuler(id)
      await charger()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleCloturer() {
    setCloturing(true)
    try {
      const r = await sessions.cloturer(session.id)
      // Mettre à jour le contexte global si c'était la session active
      if (contextSession?.id === session.id) changerSession(null)
      setRecap(r)
    } catch (err) {
      alert(err.message)
    } finally {
      setCloturing(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  if (recap) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <h2 className="font-semibold text-green-800 mb-1">Session clôturée</h2>
          <p className="text-sm text-green-700">La session a été fermée avec succès.</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Récapitulatif financier</h2>
          <RecapFinancier recap={recap} />
        </div>
        <button onClick={onRetour} className="text-sm text-blue-600 hover:underline">
          ← Retour aux sessions actives
        </button>
      </div>
    )
  }

  const ventesActives = session.ventes?.filter(v => !v.annulee) ?? []
  const caProvisoire = ventesActives.reduce((acc, v) =>
    acc + v.lignes.reduce((a, l) => a + l.prixUnitaire * l.quantite * (1 - (l.remise || 0) / 100), 0), 0
  )

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-lg shadow p-5 flex justify-between items-start">
        <div>
          <button onClick={onRetour} className="text-xs text-blue-600 hover:underline mb-2 block">
            ← Changer la session de vente
          </button>
          <h2 className="font-semibold text-gray-800 text-lg">{session.pointDeVente?.nom}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Ouverte le {DATE(session.debut)}</p>
          <p className="text-sm font-medium text-green-700 mt-1">
            {ventesActives.length} vente{ventesActives.length !== 1 ? 's' : ''} — CA provisoire : {EUR(caProvisoire)}
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

      {/* Frais */}
      <VueFraisSession
        sessionId={session.id}
        fraisList={session.frais}
        onRefresh={charger}
      />

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

// ─── Vue : liste des sessions actives ────────────────────────────────────────

function VueListeSessionsActives({ onSelectionner }) {
  const [sessionsList, setSessionsList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ouvrirForm, setOuvrirForm] = useState(false)

  async function charger() {
    try {
      setLoading(true)
      const liste = await sessions.getAll({ limit: 100 })
      setSessionsList(liste.filter(s => s.statut === 'ouverte'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">
          Sessions en cours ({sessionsList?.length ?? 0})
        </h2>
        <button
          onClick={() => setOuvrirForm(v => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
        >
          {ouvrirForm ? 'Annuler' : '+ Ouvrir une session'}
        </button>
      </div>

      {ouvrirForm && (
        <VueOuvrirSession onSessionOuverte={(id) => {
          setOuvrirForm(false)
          onSelectionner(id)
        }} />
      )}

      {sessionsList?.length === 0 && !ouvrirForm && (
        <p className="text-gray-400 text-sm">Aucune session ouverte. Créez-en une pour commencer.</p>
      )}

      <div className="space-y-2">
        {sessionsList?.map(s => {
          const ventesActives = s.ventes?.filter(v => !v.annulee) ?? []
          const ca = ventesActives.reduce((acc, v) =>
            acc + v.lignes.reduce((a, l) => a + l.prixUnitaire * l.quantite * (1 - (l.remise || 0) / 100), 0), 0
          )
          return (
            <button
              key={s.id}
              onClick={() => onSelectionner(s.id)}
              className="w-full bg-white rounded-lg shadow px-5 py-4 flex items-center justify-between text-left hover:bg-blue-50 hover:shadow-md transition-all border border-transparent hover:border-blue-200"
            >
              <div className="flex items-center gap-4">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
                <div>
                  <p className="font-semibold text-gray-800">{s.pointDeVente?.nom}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ouverte le {DATE(s.debut)}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-500">{ventesActives.length} vente(s)</span>
                <span className="font-semibold text-gray-800">{EUR(ca)}</span>
                <span className="text-blue-600 text-xs font-medium">Ouvrir →</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vue : historique des sessions ────────────────────────────────────────────

function VueHistorique() {
  const [historique, setHistorique] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [supprimant, setSupprimant] = useState(null)
  const [rouvrant, setRouvrant] = useState(null)

  async function charger() {
    try {
      setLoading(true)
      setHistorique(await sessions.getAll({ limit: 50 }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  async function handleSupprimer(id) {
    if (!window.confirm('Supprimer cette session et toutes ses ventes ? Le stock sera restauré.')) return
    setSupprimant(id)
    try {
      await sessions.supprimer(id)
      setExpanded(null)
      await charger()
    } catch (err) {
      alert(err.message)
    } finally {
      setSupprimant(null)
    }
  }

  async function handleRouvrir(id) {
    if (!window.confirm('Rouvrir cette session pour la modifier ?')) return
    setRouvrant(id)
    try {
      await sessions.rouvrir(id)
      await charger()
    } catch (err) {
      alert(err.message)
    } finally {
      setRouvrant(null)
    }
  }

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
          const totalFrais = s.frais?.reduce((a, f) => a + f.montant, 0) ?? 0
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
                  {totalFrais > 0 && <span className="text-red-500">{EUR(totalFrais)} frais</span>}
                  <span className="font-semibold text-gray-800">{EUR(ca)}</span>
                  <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  <div className="flex justify-end gap-2">
                    {s.statut === 'cloturee' && (
                      <button
                        onClick={() => handleRouvrir(s.id)}
                        disabled={rouvrant === s.id}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded disabled:opacity-50"
                      >
                        {rouvrant === s.id ? 'Réouverture…' : 'Rouvrir cette session'}
                      </button>
                    )}
                    <button
                      onClick={() => handleSupprimer(s.id)}
                      disabled={supprimant === s.id}
                      className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded disabled:opacity-50"
                    >
                      {supprimant === s.id ? 'Suppression…' : 'Supprimer cette session'}
                    </button>
                  </div>
                  {/* Ventes */}
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

                  {/* Frais de la session */}
                  {s.frais?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Frais</h4>
                      <table className="w-full text-sm">
                        <tbody>
                          {s.frais.map(f => (
                            <tr key={f.id} className="border-b border-gray-100">
                              <td className="px-4 py-1.5 text-gray-500">{f.typeFrais?.nom ?? '—'}</td>
                              <td className="px-4 py-1.5">{f.libelle}</td>
                              <td className="px-4 py-1.5 text-right text-red-600">{EUR(f.montant)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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

const VUES = ['Sessions actives', 'Historique']

export default function Ventes() {
  const { loadingSession } = useSession()
  const [vue, setVue] = useState(0)
  const [sessionSelectionnee, setSessionSelectionnee] = useState(null)

  if (loadingSession) return <Spinner />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Ventes</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {VUES.map((v, i) => (
          <button key={v} onClick={() => { setVue(i); setSessionSelectionnee(null) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              vue === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {v}
          </button>
        ))}
      </div>

      {vue === 0 && (
        sessionSelectionnee
          ? <VueDetailSession sessionId={sessionSelectionnee} onRetour={() => setSessionSelectionnee(null)} />
          : <VueListeSessionsActives onSelectionner={setSessionSelectionnee} />
      )}
      {vue === 1 && <VueHistorique />}
    </div>
  )
}
