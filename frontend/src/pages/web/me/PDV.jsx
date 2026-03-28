import { useState } from 'react'
import { useApi } from '../../../shared/hooks/useApi.js'
import { pdv } from '../../../shared/api.js'
import Spinner from '../../../components/web/Spinner.jsx'
import ErrorMessage from '../../../components/web/ErrorMessage.jsx'
import SelectRef from '../../../components/web/SelectRef.jsx'

const EUR = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

export default function PDV() {
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
        <h1 className="text-2xl font-bold text-gray-800">Points de vente</h1>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Type PDV</label>
              <SelectRef table="types-pdv" label="Type PDV" value={form.typePDVId} onChange={v => setForm(f => ({ ...f, typePDVId: v }))} />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission %</label>
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
              <th className="px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-gray-600">Commission fixe</th>
              <th className="px-4 py-3 font-medium text-gray-600">Commission %</th>
              <th className="px-4 py-3 font-medium text-gray-600">Encaissement</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Aucun point de vente</td></tr>
            )}
            {liste?.map(p => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium">{p.nom}</td>
                <td className="px-4 py-3">{p.ville ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{p.typePDV?.nom ?? '—'}</td>
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
