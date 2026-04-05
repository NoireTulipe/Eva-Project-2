import { useState } from 'react'
import { useApi } from '../../../shared/hooks/useApi.js'
import { compta, frais, pertes, produits } from '../../../shared/api.js'
import Spinner from '../../../components/web/Spinner.jsx'
import ErrorMessage from '../../../components/web/ErrorMessage.jsx'
import SelectRef from '../../../components/web/SelectRef.jsx'

const EUR = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const DATE = d => new Date(d).toLocaleDateString('fr-FR', { dateStyle: 'short' })
const DATE_LONG = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

// ─── Filtre période ───────────────────────────────────────────────────────────

function FiltrePeriode({ debut, fin, onChange }) {
  return (
    <div className="flex gap-3 items-center bg-white rounded-lg shadow px-4 py-3 mb-6">
      <span className="text-sm font-medium text-gray-600">Période :</span>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Du</label>
        <input type="date" value={debut} onChange={e => onChange('debut', e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">au</label>
        <input type="date" value={fin} onChange={e => onChange('fin', e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm" />
      </div>
      <button onClick={() => onChange('reset')}
        className="text-xs text-gray-400 hover:text-gray-600 underline ml-2">
        Tout afficher
      </button>
    </div>
  )
}

// ─── Onglet Bilan ─────────────────────────────────────────────────────────────

function OngletBilan({ debut, fin }) {
  const { data, loading, error } = useApi(
    () => compta.getRecap({ debut: debut || undefined, fin: fin || undefined }),
    [debut, fin]
  )
  const [coutExpanded, setCoutExpanded] = useState(false)

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />
  if (!data) return null

  const { recap } = data

  // Calcul du coût de réapprovisionnement par produit
  const coutParProduit = {}
  for (const session of data.sessions ?? []) {
    for (const vente of session.ventes ?? []) {
      if (vente.annulee) continue
      for (const ligne of vente.lignes ?? []) {
        const p = ligne.produit
        if (!p || !p.cout) continue
        if (!coutParProduit[p.id]) {
          coutParProduit[p.id] = { nom: p.nom, quantite: 0, cout: p.cout, total: 0 }
        }
        coutParProduit[p.id].quantite += ligne.quantite
        coutParProduit[p.id].total += ligne.quantite * p.cout
      }
    }
  }
  const lignesCout = Object.values(coutParProduit).sort((a, b) => b.total - a.total)
  const totalCout = lignesCout.reduce((a, l) => a + l.total, 0)

  const totalCharges = recap.totalCommissionPDV + recap.totalDroitsAuteur + recap.totalFrais + recap.totalPertes + totalCout

  return (
    <div className="space-y-6">

      {/* Tableau récapitulatif comptable */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700">Récapitulatif financier</h3>
          <span className="text-xs text-gray-400">{recap.nbSessions} session(s) clôturée(s)</span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {/* CA */}
            <tr className="border-b border-gray-100 bg-green-50">
              <td className="px-5 py-3 font-semibold text-gray-800">Chiffre d'affaires</td>
              <td className="px-5 py-3 text-right font-bold text-green-700 text-base">{EUR(recap.totalCA)}</td>
            </tr>

            {/* Séparateur charges */}
            <tr className="bg-gray-100">
              <td colSpan={2} className="px-5 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Charges</td>
            </tr>

            {/* Coût de réappro */}
            <tr className="border-b border-gray-100">
              <td className="px-5 py-3">
                <button
                  onClick={() => setCoutExpanded(v => !v)}
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <span className="font-medium">Coût de réapprovisionnement</span>
                  {lignesCout.length > 0 && (
                    <span className="text-xs text-gray-400">{coutExpanded ? '▲ masquer' : '▼ détail'}</span>
                  )}
                  {lignesCout.length === 0 && (
                    <span className="text-xs text-gray-400 italic">(aucun coût renseigné)</span>
                  )}
                </button>
                {coutExpanded && lignesCout.length > 0 && (
                  <div className="mt-2 ml-3 space-y-1">
                    {lignesCout.map(l => (
                      <div key={l.nom} className="flex justify-between text-xs text-gray-500 border-l-2 border-gray-200 pl-3">
                        <span>{l.quantite} × {l.nom} à {EUR(l.cout)}</span>
                        <span className="font-medium text-red-500 ml-8">{EUR(l.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-5 py-3 text-right font-medium text-red-600">
                {totalCout > 0 ? EUR(totalCout) : '—'}
              </td>
            </tr>

            {/* Droits auteur */}
            <tr className="border-b border-gray-100">
              <td className="px-5 py-3 text-gray-700">Droits d'auteur</td>
              <td className="px-5 py-3 text-right font-medium text-red-600">
                {recap.totalDroitsAuteur > 0 ? EUR(recap.totalDroitsAuteur) : '—'}
              </td>
            </tr>

            {/* Commissions PDV */}
            <tr className="border-b border-gray-100">
              <td className="px-5 py-3 text-gray-700">Commissions lieu de vente</td>
              <td className="px-5 py-3 text-right font-medium text-red-600">
                {recap.totalCommissionPDV > 0 ? EUR(recap.totalCommissionPDV) : '—'}
              </td>
            </tr>

            {/* Frais */}
            <tr className="border-b border-gray-100">
              <td className="px-5 py-3 text-gray-700">Frais (déplacements, matériel…)</td>
              <td className="px-5 py-3 text-right font-medium text-red-600">
                {recap.totalFrais > 0 ? EUR(recap.totalFrais) : '—'}
              </td>
            </tr>

            {/* Pertes */}
            <tr className="border-b border-gray-200">
              <td className="px-5 py-3 text-gray-700">Pertes</td>
              <td className="px-5 py-3 text-right font-medium text-red-600">
                {recap.totalPertes > 0 ? EUR(recap.totalPertes) : '—'}
              </td>
            </tr>

            {/* Total charges */}
            <tr className="border-b-2 border-gray-300 bg-red-50">
              <td className="px-5 py-3 font-semibold text-gray-700">Total des charges</td>
              <td className="px-5 py-3 text-right font-bold text-red-600">{EUR(totalCharges)}</td>
            </tr>

            {/* Résultat net */}
            <tr className={recap.beneficeNet >= 0 ? 'bg-blue-50' : 'bg-red-50'}>
              <td className="px-5 py-4 font-bold text-gray-800 text-base">Résultat net</td>
              <td className={`px-5 py-4 text-right font-bold text-lg ${recap.beneficeNet >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {EUR(recap.beneficeNet)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tableau récap sessions */}
      {data.sessions?.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-medium text-gray-700">Détail par session</h3>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">PDV</th>
                <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">CA</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Commission</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Frais</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Ventes</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map(s => {
                const ventesActives = s.ventes?.filter(v => !v.annulee) ?? []
                const ca = ventesActives.reduce((acc, v) =>
                  acc + v.lignes.reduce((a, l) => a + l.prixUnitaire * l.quantite * (1 - (l.remise || 0) / 100), 0), 0
                )
                const totalFraisSession = s.frais?.reduce((a, f) => a + f.montant, 0) ?? 0
                const commission = (s.pointDeVente?.commissionFixe ?? 0) + ca * ((s.pointDeVente?.commissionPourcent ?? 0) / 100)
                return (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium">{s.pointDeVente?.nom}</td>
                    <td className="px-4 py-3 text-gray-500">{DATE_LONG(s.debut)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">{EUR(ca)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{commission > 0 ? EUR(commission) : '—'}</td>
                    <td className="px-4 py-3 text-right text-red-600">{totalFraisSession > 0 ? EUR(totalFraisSession) : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{ventesActives.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Onglet Frais ─────────────────────────────────────────────────────────────

function OngletFrais({ debut, fin }) {
  const { data: liste, loading, error, refetch } = useApi(
    () => frais.getAll({ debut: debut || undefined, fin: fin || undefined }),
    [debut, fin]
  )
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  function ouvrirForm() {
    setForm({ typeFraisId: '', libelle: '', montant: '' })
    setFormError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await frais.create({
        typeFraisId: Number(form.typeFraisId),
        libelle: form.libelle,
        montant: Number(form.montant),
      })
      setForm(null)
      refetch()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSupprimer(id) {
    if (!confirm('Supprimer ce frais ?')) return
    try {
      await frais.remove(id)
      refetch()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  const total = liste?.reduce((a, f) => a + f.montant, 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{liste?.length ?? 0} frais — Total : <span className="font-semibold text-red-600">{EUR(total)}</span></p>
        <button onClick={ouvrirForm} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
          + Ajouter un frais
        </button>
      </div>

      {form && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-medium mb-4">Nouveau frais hors session</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
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
              <input type="number" step="0.01" min="0" value={form.montant}
                onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            {formError && <div className="col-span-3"><ErrorMessage message={formError} /></div>}
            <div className="col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">Annuler</button>
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
              <th className="px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-gray-600">Libellé</th>
              <th className="px-4 py-3 font-medium text-gray-600">Session</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Montant</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Aucun frais</td></tr>
            )}
            {liste?.map(f => (
              <tr key={f.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500">{DATE(f.createdAt)}</td>
                <td className="px-4 py-3 text-gray-500">{f.typeFrais?.nom ?? '—'}</td>
                <td className="px-4 py-3">{f.libelle}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {f.session ? `${f.session.pointDeVente?.nom ?? ''} — ${DATE(f.session.debut)}` : 'Hors session'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-red-600">{EUR(f.montant)}</td>
                <td className="px-4 py-3 text-right">
                  {!f.session && (
                    <button onClick={() => handleSupprimer(f.id)} className="text-red-500 hover:underline text-xs">Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Onglet Pertes ────────────────────────────────────────────────────────────

function OngletPertes({ debut, fin }) {
  const { data: liste, loading, error, refetch } = useApi(
    () => pertes.getAll({ debut: debut || undefined, fin: fin || undefined }),
    [debut, fin]
  )
  const { data: listeProduits } = useApi(() => produits.getAll())
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  function ouvrirForm() {
    setForm({ typePerteid: '', produitId: '', quantite: '', valeur: '', description: '' })
    setFormError(null)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await pertes.create({
        typePerteid: Number(form.typePerteid),
        produitId: form.produitId ? Number(form.produitId) : undefined,
        quantite: form.quantite ? Number(form.quantite) : undefined,
        valeur: Number(form.valeur),
        description: form.description || undefined,
      })
      setForm(null)
      refetch()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSupprimer(id) {
    if (!confirm('Supprimer cette perte ?')) return
    try {
      await pertes.remove(id)
      refetch()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  const total = liste?.reduce((a, p) => a + p.valeur, 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{liste?.length ?? 0} perte(s) — Total : <span className="font-semibold text-red-600">{EUR(total)}</span></p>
        <button onClick={ouvrirForm} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
          + Déclarer une perte
        </button>
      </div>

      {form && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-medium mb-4">Nouvelle perte</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <SelectRef table="types-perte" label="Type de perte"
                value={form.typePerteid}
                onChange={v => setForm(f => ({ ...f, typePerteid: v }))}
                required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valeur (€) *</label>
              <input name="valeur" type="number" step="0.01" min="0" value={form.valeur}
                onChange={handleChange} required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Produit concerné</label>
              <select name="produitId" value={form.produitId} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">— Aucun produit spécifique —</option>
                {listeProduits?.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
              <input name="quantite" type="number" min="1" value={form.quantite}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input name="description" value={form.description} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            {formError && <div className="col-span-2"><ErrorMessage message={formError} /></div>}
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">Annuler</button>
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
              <th className="px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-gray-600">Produit</th>
              <th className="px-4 py-3 font-medium text-gray-600">Qté</th>
              <th className="px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Valeur</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Aucune perte enregistrée</td></tr>
            )}
            {liste?.map(p => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500">{DATE(p.createdAt)}</td>
                <td className="px-4 py-3 text-gray-500">{p.typePerte?.nom ?? '—'}</td>
                <td className="px-4 py-3">{p.produit?.nom ?? '—'}</td>
                <td className="px-4 py-3">{p.quantite ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{p.description ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-red-600">{EUR(p.valeur)}</td>
                <td className="px-4 py-3 text-right">
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

// ─── Onglet Droits d'auteur ───────────────────────────────────────────────────

function OngletDroitsAuteur({ debut, fin }) {
  const { data, loading, error } = useApi(
    () => compta.getDroitsAuteur({ debut: debut || undefined, fin: fin || undefined }),
    [debut, fin]
  )
  const [expanded, setExpanded] = useState(null)

  if (loading) return <Spinner />
  if (error) return <ErrorMessage message={error} />

  const totalGlobal = data?.reduce((a, e) => a + e.totalDroits, 0) ?? 0

  return (
    <div className="space-y-4">
      {/* Bandeau total */}
      <div className="bg-white rounded-lg shadow px-5 py-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total à reverser sur la période</p>
          <p className={`text-2xl font-bold ${totalGlobal > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {EUR(totalGlobal)}
          </p>
        </div>
        <span className="text-sm text-gray-400">{data?.length ?? 0} auteur(s) concerné(s)</span>
      </div>

      {data?.length === 0 && (
        <p className="text-sm text-gray-400 px-1">
          Aucun droit d'auteur à reverser sur cette période.<br />
          <span className="text-xs">Vérifiez que les produits ont un coût d'auteur configuré (% droits auteur dans le catalogue).</span>
        </p>
      )}

      {/* Un bloc dépliable par auteur */}
      <div className="space-y-2">
        {data?.map(({ auteur, totalDroits, produits }) => {
          const isOpen = expanded === auteur.id
          const nomComplet = auteur.prenom ? `${auteur.prenom} ${auteur.nom}` : auteur.nom

          return (
            <div key={auteur.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* En-tête auteur */}
              <button
                onClick={() => setExpanded(isOpen ? null : auteur.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {auteur.nom.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{nomComplet}</p>
                    {auteur.email && <p className="text-xs text-gray-400">{auteur.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-0.5">{produits.length} titre(s)</p>
                    <p className="font-bold text-red-600 text-base">{EUR(totalDroits)}</p>
                  </div>
                  <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Détail des livres */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-2.5 text-left font-medium text-gray-500">Titre</th>
                        <th className="px-5 py-2.5 text-right font-medium text-gray-500">Taux</th>
                        <th className="px-5 py-2.5 text-right font-medium text-gray-500">Qté vendue</th>
                        <th className="px-5 py-2.5 text-right font-medium text-gray-500">CA généré</th>
                        <th className="px-5 py-2.5 text-right font-medium text-gray-500">Droits à reverser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produits.map(({ produit, quantite, ca, droits }) => (
                        <tr key={produit.id} className="border-t border-gray-100">
                          <td className="px-5 py-3 font-medium text-gray-800">{produit.nom}</td>
                          <td className="px-5 py-3 text-right text-gray-500">{produit.droitAuteurPourcent} %</td>
                          <td className="px-5 py-3 text-right text-gray-600">{quantite}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{EUR(ca)}</td>
                          <td className="px-5 py-3 text-right font-semibold text-red-600">{EUR(droits)}</td>
                        </tr>
                      ))}
                      {/* Sous-total auteur */}
                      <tr className="border-t-2 border-gray-200 bg-indigo-50">
                        <td colSpan={4} className="px-5 py-2.5 font-semibold text-gray-700 text-right">
                          Total {nomComplet}
                        </td>
                        <td className="px-5 py-2.5 text-right font-bold text-red-600">{EUR(totalDroits)}</td>
                      </tr>
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

const ONGLETS = ['Bilan', 'Frais', 'Pertes', "Droits d'auteur"]

export default function Compta() {
  const [onglet, setOnglet] = useState(0)
  const now = new Date()
  const debutAnnee = `${now.getFullYear()}-01-01`
  const [debut, setDebut] = useState(debutAnnee)
  const [fin, setFin] = useState('')

  function handleFiltre(champ, valeur) {
    if (champ === 'reset') { setDebut(''); setFin(''); return }
    if (champ === 'debut') setDebut(valeur)
    if (champ === 'fin') setFin(valeur)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Comptabilité</h1>

      <FiltrePeriode debut={debut} fin={fin} onChange={handleFiltre} />

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {ONGLETS.map((o, i) => (
          <button key={o} onClick={() => setOnglet(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              onglet === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {o}
          </button>
        ))}
      </div>

      {onglet === 0 && <OngletBilan debut={debut} fin={fin} />}
      {onglet === 1 && <OngletFrais debut={debut} fin={fin} />}
      {onglet === 2 && <OngletPertes debut={debut} fin={fin} />}
      {onglet === 3 && <OngletDroitsAuteur debut={debut} fin={fin} />}
    </div>
  )
}
