import { useState } from 'react'
import { useApi } from '../../shared/hooks/useApi.js'
import { produits, pdv, sessions, ventes } from '../../shared/api.js'
import Spinner from '../../components/web/Spinner.jsx'
import ErrorMessage from '../../components/web/ErrorMessage.jsx'

const TABS = ['Produits', 'Points de vente', 'Sessions']

const EUR = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

// ---- Onglet Produits ----

function TabProduits() {
  const { data: liste, loading, error, refetch } = useApi(() => produits.getAll())
  const [form, setForm] = useState(null) // null = fermé, {} = nouveau, {id,...} = édition
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  function ouvrirNouveauForm() {
    setForm({ nom: '', categorieId: '', prixVenteTTC: '', tva: '5.5', cout: '', droitAuteur: false, droitAuteurPourcent: '', stock: '', stockAlerte: '' })
    setFormError(null)
  }

  function ouvrirEditionForm(p) {
    setForm({ ...p, categorieId: p.categorieId ?? '', droitAuteurPourcent: p.droitAuteurPourcent ?? '' })
    setFormError(null)
  }

  function fermerForm() { setForm(null); setFormError(null) }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        nom: form.nom,
        categorieId: form.categorieId ? Number(form.categorieId) : undefined,
        prixVenteTTC: Number(form.prixVenteTTC),
        tva: Number(form.tva),
        cout: form.cout !== '' ? Number(form.cout) : undefined,
        droitAuteur: form.droitAuteur,
        droitAuteurPourcent: form.droitAuteurPourcent !== '' ? Number(form.droitAuteurPourcent) : undefined,
        stock: Number(form.stock),
        stockAlerte: form.stockAlerte !== '' ? Number(form.stockAlerte) : undefined
      }
      if (form.id) {
        await produits.update(form.id, payload)
      } else {
        await produits.create(payload)
      }
      fermerForm()
      refetch()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSupprimer(id) {
    try {
      await produits.remove(id)
      refetch()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Produits</h2>
        <button onClick={ouvrirNouveauForm} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
          + Nouveau produit
        </button>
      </div>

      {form !== null && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-medium mb-4">{form.id ? 'Modifier le produit' : 'Nouveau produit'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie (ID)</label>
              <input name="categorieId" type="number" value={form.categorieId} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix TTC (€) *</label>
              <input name="prixVenteTTC" type="number" step="0.01" value={form.prixVenteTTC} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TVA (%)</label>
              <input name="tva" type="number" step="0.1" value={form.tva} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coût (€)</label>
              <input name="cout" type="number" step="0.01" value={form.cout} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
              <input name="stock" type="number" value={form.stock} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seuil alerte stock</label>
              <input name="stockAlerte" type="number" value={form.stockAlerte} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input name="droitAuteur" type="checkbox" checked={form.droitAuteur} onChange={handleChange} id="droitAuteur" className="rounded" />
              <label htmlFor="droitAuteur" className="text-sm font-medium text-gray-700">Droits auteur</label>
              {form.droitAuteur && (
                <input name="droitAuteurPourcent" type="number" step="0.1" value={form.droitAuteurPourcent} onChange={handleChange} placeholder="%" className="ml-2 w-24 border border-gray-300 rounded px-3 py-2 text-sm" />
              )}
            </div>
            <ErrorMessage message={formError} />
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={fermerForm} className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Prix TTC</th>
              <th className="px-4 py-3 font-medium text-gray-600">Stock</th>
              <th className="px-4 py-3 font-medium text-gray-600">Alerte</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Aucun produit</td></tr>
            )}
            {liste?.map(p => (
              <tr key={p.id} className={`border-b border-gray-100 ${p.stock <= p.stockAlerte ? 'bg-yellow-50' : ''}`}>
                <td className="px-4 py-3 font-medium">{p.nom}</td>
                <td className="px-4 py-3">{EUR(p.prixVenteTTC)}</td>
                <td className="px-4 py-3">{p.stock}</td>
                <td className="px-4 py-3 text-gray-400">{p.stockAlerte ?? '—'}</td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  <button onClick={() => ouvrirEditionForm(p)} className="text-blue-600 hover:underline text-xs">Modifier</button>
                  <button onClick={() => handleSupprimer(p.id)} className="text-red-500 hover:underline text-xs">Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Onglet PDV ----

function TabPDV() {
  const { data: liste, loading, error, refetch } = useApi(() => pdv.getAll())
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  function ouvrirNouveauForm() {
    setForm({ nom: '', adresse: '', ville: '', typePDVId: '', commissionFixe: '', commissionPourcent: '', typeEncaissement: 'pdv' })
    setFormError(null)
  }

  function ouvrirEditionForm(p) {
    setForm({ ...p, typePDVId: p.typePDVId ?? '', commissionFixe: p.commissionFixe ?? '', commissionPourcent: p.commissionPourcent ?? '' })
    setFormError(null)
  }

  function fermerForm() { setForm(null); setFormError(null) }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        nom: form.nom,
        adresse: form.adresse || undefined,
        ville: form.ville || undefined,
        typePDVId: form.typePDVId ? Number(form.typePDVId) : undefined,
        commissionFixe: form.commissionFixe !== '' ? Number(form.commissionFixe) : undefined,
        commissionPourcent: form.commissionPourcent !== '' ? Number(form.commissionPourcent) : undefined,
        typeEncaissement: form.typeEncaissement || undefined
      }
      if (form.id) {
        await pdv.update(form.id, payload)
      } else {
        await pdv.create(payload)
      }
      fermerForm()
      refetch()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Points de vente</h2>
        <button onClick={ouvrirNouveauForm} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
          + Nouveau PDV
        </button>
      </div>

      {form !== null && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-medium mb-4">{form.id ? 'Modifier le PDV' : 'Nouveau PDV'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input name="adresse" value={form.adresse} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input name="ville" value={form.ville} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type PDV (ID)</label>
              <input name="typePDVId" type="number" value={form.typePDVId} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Encaissement</label>
              <select name="typeEncaissement" value={form.typeEncaissement} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="pdv">PDV encaisse</option>
                <option value="nous">Nous encaissons</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission fixe (€)</label>
              <input name="commissionFixe" type="number" step="0.01" value={form.commissionFixe} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission % </label>
              <input name="commissionPourcent" type="number" step="0.1" value={form.commissionPourcent} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <ErrorMessage message={formError} />
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={fermerForm} className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Ville</th>
              <th className="px-4 py-3 font-medium text-gray-600">Commission fixe</th>
              <th className="px-4 py-3 font-medium text-gray-600">Commission %</th>
              <th className="px-4 py-3 font-medium text-gray-600">Encaissement</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Aucun point de vente</td></tr>
            )}
            {liste?.map(p => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium">{p.nom}</td>
                <td className="px-4 py-3">{p.ville ?? '—'}</td>
                <td className="px-4 py-3">{p.commissionFixe != null ? EUR(p.commissionFixe) : '—'}</td>
                <td className="px-4 py-3">{p.commissionPourcent != null ? `${p.commissionPourcent}%` : '—'}</td>
                <td className="px-4 py-3">{p.typeEncaissement ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => ouvrirEditionForm(p)} className="text-blue-600 hover:underline text-xs">Modifier</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Onglet Sessions ----

function TabSessions() {
  const { data: listePDV } = useApi(() => pdv.getAll())
  const { data: listeProduits } = useApi(() => produits.getAll())

  const [session, setSession] = useState(null)
  const [recap, setRecap] = useState(null)
  const [openForm, setOpenForm] = useState({ pointDeVenteId: '', debut: new Date().toISOString().slice(0, 16) })
  const [openError, setOpenError] = useState(null)
  const [opening, setOpening] = useState(false)

  const [venteForm, setVenteForm] = useState({ produitId: '', quantite: 1, prixUnitaire: '', remise: 0, methodePaiementId: 1 })
  const [venteError, setVenteError] = useState(null)
  const [venteLoading, setVenteLoading] = useState(false)

  async function handleOuvrirSession(e) {
    e.preventDefault()
    setOpening(true)
    setOpenError(null)
    try {
      const s = await sessions.open(Number(openForm.pointDeVenteId), new Date(openForm.debut).toISOString())
      const detail = await sessions.getById(s.id)
      setSession(detail)
    } catch (err) {
      setOpenError(err.message)
    } finally {
      setOpening(false)
    }
  }

  async function rechargerSession() {
    if (!session) return
    const detail = await sessions.getById(session.id)
    setSession(detail)
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
    try {
      const result = await sessions.cloturer(session.id)
      setRecap(result)
      await rechargerSession()
    } catch (err) {
      alert(err.message)
    }
  }

  function handleProduitChange(e) {
    const id = e.target.value
    const produit = listeProduits?.find(p => String(p.id) === id)
    setVenteForm(f => ({ ...f, produitId: id, prixUnitaire: produit ? produit.prixVenteTTC : '' }))
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Sessions de vente</h2>

      {session === null && (
        <div className="bg-white rounded-lg shadow p-6 max-w-md">
          <h3 className="font-medium mb-4">Ouvrir une session</h3>
          <form onSubmit={handleOuvrirSession} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Point de vente *</label>
              <select
                value={openForm.pointDeVenteId}
                onChange={e => setOpenForm(f => ({ ...f, pointDeVenteId: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">-- Choisir --</option>
                {listePDV?.map(p => <option key={p.id} value={p.id}>{p.nom}{p.ville ? ` — ${p.ville}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de début</label>
              <input
                type="datetime-local"
                value={openForm.debut}
                onChange={e => setOpenForm(f => ({ ...f, debut: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <ErrorMessage message={openError} />
            <button type="submit" disabled={opening} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm">
              {opening ? 'Ouverture...' : 'Ouvrir la session'}
            </button>
          </form>
        </div>
      )}

      {session !== null && (
        <div className="space-y-6">
          {/* En-tête session */}
          <div className="bg-white rounded-lg shadow p-6 flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-800">{session.pointDeVente?.nom}</h3>
              <p className="text-sm text-gray-500">
                Ouverture : {new Date(session.debut).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${session.statut === 'ouverte' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {session.statut}
              </span>
              {session.statut === 'ouverte' && (
                <button onClick={handleCloturer} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm">
                  Clôturer
                </button>
              )}
            </div>
          </div>

          {/* Récapitulatif clôture */}
          {recap && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Récapitulatif de clôture</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'CA total', value: recap.ca },
                  { label: 'Commission PDV', value: recap.commissionPDV },
                  { label: 'Droits auteur', value: recap.droitsAuteur },
                  { label: 'Frais', value: recap.totalFrais },
                  { label: 'Bénéfice net', value: recap.beneficeNet }
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="font-semibold text-gray-800">{value != null ? EUR(value) : '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulaire nouvelle vente */}
          {session.statut === 'ouverte' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium mb-4">Enregistrer une vente</h3>
              <form onSubmit={handleEnregistrerVente} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Produit *</label>
                  <select value={venteForm.produitId} onChange={handleProduitChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="">-- Choisir --</option>
                    {listeProduits?.map(p => <option key={p.id} value={p.id}>{p.nom} (stock : {p.stock})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
                  <input type="number" min="1" value={venteForm.quantite} onChange={e => setVenteForm(f => ({ ...f, quantite: e.target.value }))} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire (€) *</label>
                  <input type="number" step="0.01" value={venteForm.prixUnitaire} onChange={e => setVenteForm(f => ({ ...f, prixUnitaire: e.target.value }))} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remise (%)</label>
                  <input type="number" step="0.1" min="0" max="100" value={venteForm.remise} onChange={e => setVenteForm(f => ({ ...f, remise: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Méthode paiement (ID)</label>
                  <input type="number" value={venteForm.methodePaiementId} onChange={e => setVenteForm(f => ({ ...f, methodePaiementId: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2 md:col-span-4 flex gap-2">
                  <ErrorMessage message={venteError} />
                  <button type="submit" disabled={venteLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm ml-auto">
                    {venteLoading ? 'Enregistrement...' : 'Enregistrer la vente'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Liste des ventes */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-700">Ventes de la session ({session.ventes?.length ?? 0})</h3>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600">Produit</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Qté</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Prix unit.</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Remise</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {session.ventes?.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Aucune vente</td></tr>
                )}
                {session.ventes?.map(v =>
                  v.lignes?.map((l, i) => (
                    <tr key={`${v.id}-${i}`} className={`border-b border-gray-100 ${v.statut === 'annulee' ? 'opacity-50 line-through' : ''}`}>
                      <td className="px-4 py-3">{l.produit?.nom ?? `Produit #${l.produitId}`}</td>
                      <td className="px-4 py-3">{l.quantite}</td>
                      <td className="px-4 py-3">{EUR(l.prixUnitaire)}</td>
                      <td className="px-4 py-3">{l.remise ? `${l.remise}%` : '—'}</td>
                      <td className="px-4 py-3">{v.statut}</td>
                      <td className="px-4 py-3 text-right">
                        {v.statut !== 'annulee' && session.statut === 'ouverte' && (
                          <button onClick={() => handleAnnulerVente(v.id)} className="text-red-500 hover:underline text-xs">Annuler</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Page principale Ventes ----

export default function Ventes() {
  const [tab, setTab] = useState(0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Ventes</h1>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <TabProduits />}
      {tab === 1 && <TabPDV />}
      {tab === 2 && <TabSessions />}
    </div>
  )
}
