import { useState } from 'react'
import { useApi } from '../../../shared/hooks/useApi.js'
import { produits } from '../../../shared/api.js'
import Spinner from '../../../components/web/Spinner.jsx'
import ErrorMessage from '../../../components/web/ErrorMessage.jsx'
import SelectRef from '../../../components/web/SelectRef.jsx'

const EUR = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

export default function Produits() {
  const { data: liste, loading, error, refetch } = useApi(() => produits.getAll())
  const [form, setForm] = useState(null)
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
        <h1 className="text-2xl font-bold text-gray-800">Produits</h1>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <SelectRef table="categories" label="Catégorie" value={form.categorieId} onChange={v => setForm(f => ({ ...f, categorieId: v }))} required />
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
              <th className="px-4 py-3 font-medium text-gray-600">Catégorie</th>
              <th className="px-4 py-3 font-medium text-gray-600">Prix TTC</th>
              <th className="px-4 py-3 font-medium text-gray-600">Stock</th>
              <th className="px-4 py-3 font-medium text-gray-600">Alerte</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Aucun produit</td></tr>
            )}
            {liste?.map(p => (
              <tr key={p.id} className={`border-b border-gray-100 ${p.stock <= p.stockAlerte ? 'bg-yellow-50' : ''}`}>
                <td className="px-4 py-3 font-medium">{p.nom}</td>
                <td className="px-4 py-3 text-gray-500">{p.categorie?.nom ?? '—'}</td>
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
