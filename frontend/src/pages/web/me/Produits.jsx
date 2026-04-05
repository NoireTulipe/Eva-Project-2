import { useState } from 'react'
import { useApi } from '../../../shared/hooks/useApi.js'
import { produits, auteurs } from '../../../shared/api.js'
import Spinner from '../../../components/web/Spinner.jsx'
import ErrorMessage from '../../../components/web/ErrorMessage.jsx'
import SelectRef from '../../../components/web/SelectRef.jsx'

const EUR = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

// ─── Gestion des auteurs ───────────────────────────────────────────────────────

function GestionAuteurs() {
  const { data: liste, loading, error, refetch } = useApi(() => auteurs.getAll())
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  function ouvrirNouveauForm() {
    setForm({ nom: '', prenom: '', email: '' })
    setFormError(null)
  }

  function ouvrirEditionForm(a) {
    setForm({ ...a, prenom: a.prenom ?? '', email: a.email ?? '' })
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
      const payload = { nom: form.nom, prenom: form.prenom || undefined, email: form.email || undefined }
      if (form.id) {
        await auteurs.update(form.id, payload)
      } else {
        await auteurs.create(payload)
      }
      setForm(null)
      refetch()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSupprimer(id) {
    if (!confirm('Supprimer cet auteur ? Les liaisons avec les produits seront supprimées.')) return
    try {
      await auteurs.remove(id)
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
        <h2 className="text-xl font-bold text-gray-800">Auteurs</h2>
        <button onClick={ouvrirNouveauForm} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
          + Nouvel auteur
        </button>
      </div>

      {form !== null && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-medium mb-4">{form.id ? 'Modifier l\'auteur' : 'Nouvel auteur'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input name="prenom" value={form.prenom} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <ErrorMessage message={formError} />
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
              <th className="px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Prénom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste?.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aucun auteur</td></tr>
            )}
            {liste?.map(a => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium">{a.nom}</td>
                <td className="px-4 py-3">{a.prenom ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{a.email ?? '—'}</td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  <button onClick={() => ouvrirEditionForm(a)} className="text-blue-600 hover:underline text-xs">Modifier</button>
                  <button onClick={() => handleSupprimer(a.id)} className="text-red-500 hover:underline text-xs">Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Sélecteur d'auteurs pour un produit ──────────────────────────────────────

function SelecteurAuteurs({ valeur, onChange, listeAuteurs }) {
  function toggle(id) {
    if (valeur.includes(id)) {
      onChange(valeur.filter(v => v !== id))
    } else {
      onChange([...valeur, id])
    }
  }

  if (!listeAuteurs?.length) return <p className="text-xs text-gray-400">Aucun auteur disponible</p>

  return (
    <div className="flex flex-wrap gap-2">
      {listeAuteurs.map(a => {
        const selected = valeur.includes(a.id)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              selected
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {a.prenom ? `${a.prenom} ${a.nom}` : a.nom}
          </button>
        )
      })}
    </div>
  )
}

// ─── Gestion des produits ──────────────────────────────────────────────────────

function GestionProduits() {
  const { data: liste, loading, error, refetch } = useApi(() => produits.getAll())
  const { data: listeAuteurs } = useApi(() => auteurs.getAll())
  const [form, setForm] = useState(null)
  const [auteurIds, setAuteurIds] = useState([])
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  function ouvrirNouveauForm() {
    setForm({ nom: '', categorieId: '', prixVenteTTC: '', tva: '5.5', cout: '', droitAuteur: false, droitAuteurPourcent: '', stock: '', stockAlerte: '' })
    setAuteurIds([])
    setImageFile(null)
    setImagePreview(null)
    setFormError(null)
  }

  function ouvrirEditionForm(p) {
    setForm({ ...p, categorieId: p.categorieId ?? '', droitAuteurPourcent: p.droitAuteurPourcent ?? '' })
    setAuteurIds(p.auteurs?.map(a => a.auteurId) ?? [])
    setImageFile(null)
    setImagePreview(p.imageUrl || null)
    setFormError(null)
  }

  function fermerForm() { setForm(null); setImageFile(null); setImagePreview(null); setFormError(null) }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSupprimerImage() {
    if (!form?.id) return
    try {
      const updated = await produits.deleteImage(form.id)
      setForm(f => ({ ...f, imageUrl: null }))
      setImagePreview(null)
      setImageFile(null)
      refetch()
    } catch (err) { setFormError(err.message) }
  }

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
      let id = form.id
      if (id) {
        await produits.update(id, payload)
      } else {
        const created = await produits.create(payload)
        id = created.id
      }
      // Mettre à jour les auteurs
      await auteurs.setForProduit(id, auteurIds)
      // Uploader l'image si une nouvelle a été sélectionnée
      if (imageFile) await produits.uploadImage(id, imageFile)
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
        <h2 className="text-xl font-bold text-gray-800">Catalogue produits</h2>
        <button onClick={ouvrirNouveauForm} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
          + Nouveau produit
        </button>
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-lg">{form.id ? 'Modifier le produit' : 'Nouveau produit'}</h3>
                <button type="button" onClick={fermerForm} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
              </div>
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
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Auteurs</label>
                  <SelecteurAuteurs valeur={auteurIds} onChange={setAuteurIds} listeAuteurs={listeAuteurs} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image couverture</label>
                  <div className="flex items-center gap-4">
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        className="w-16 h-20 object-cover rounded border border-gray-200"
                        alt="Couverture"
                      />
                    )}
                    <div className="flex flex-col gap-2">
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange}
                        className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      {form?.imageUrl && !imageFile && (
                        <button type="button" onClick={handleSupprimerImage}
                          className="text-xs text-red-500 hover:underline text-left">
                          Supprimer l'image
                        </button>
                      )}
                    </div>
                  </div>
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
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 w-12"></th>
              <th className="px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Catégorie</th>
              <th className="px-4 py-3 font-medium text-gray-600">Auteurs</th>
              <th className="px-4 py-3 font-medium text-gray-600">Prix TTC</th>
              <th className="px-4 py-3 font-medium text-gray-600">Stock</th>
              <th className="px-4 py-3 font-medium text-gray-600">Alerte</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste?.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Aucun produit</td></tr>
            )}
            {liste?.map(p => (
              <tr key={p.id} className={`border-b border-gray-100 ${p.stock <= p.stockAlerte ? 'bg-yellow-50' : ''}`}>
                <td className="px-2 py-2">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="" className="w-8 h-10 object-cover rounded border border-gray-100" />
                    : <div className="w-8 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-300 text-xs">—</div>
                  }
                </td>
                <td className="px-4 py-3 font-medium">{p.nom}</td>
                <td className="px-4 py-3 text-gray-500">{p.categorie?.nom ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {p.auteurs?.length > 0
                    ? p.auteurs.map(a => a.auteur?.prenom ? `${a.auteur.prenom} ${a.auteur.nom}` : a.auteur?.nom).join(', ')
                    : '—'}
                </td>
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

// ─── Page principale ───────────────────────────────────────────────────────────

const ONGLETS = ['Catalogue', 'Auteurs']

export default function Produits() {
  const [onglet, setOnglet] = useState(0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Produits</h1>

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

      {onglet === 0 && <GestionProduits />}
      {onglet === 1 && <GestionAuteurs />}
    </div>
  )
}
