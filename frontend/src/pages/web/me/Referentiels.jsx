import { useState } from 'react'
import { useApi } from '../../../shared/hooks/useApi.js'
import { ref } from '../../../shared/api.js'
import Spinner from '../../../components/web/Spinner.jsx'
import ErrorMessage from '../../../components/web/ErrorMessage.jsx'

const TABLES = [
  { key: 'categories',          label: 'Catégories de produits' },
  { key: 'types-pdv',           label: 'Types de PDV' },
  { key: 'methodes-paiement',   label: 'Méthodes de paiement' },
  { key: 'types-frais',         label: 'Types de frais' },
  { key: 'types-hors-stock',    label: 'Types de mouvement hors-stock' },
  { key: 'types-perte',         label: 'Types de perte' },
  { key: 'types-contact',       label: 'Types de contact' },
]

function TableRef({ table, label }) {
  const { data: liste, loading, error, refetch } = useApi(() => ref.getAll(table), [table])
  const [nouveauNom, setNouveauNom] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editNom, setEditNom] = useState('')
  const [editError, setEditError] = useState(null)

  async function handleAjouter(e) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      await ref.create(table, nouveauNom)
      setNouveauNom('')
      refetch()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  function startEdit(item) {
    setEditId(item.id)
    setEditNom(item.nom)
    setEditError(null)
  }

  async function handleRenommer(e) {
    e.preventDefault()
    setEditError(null)
    try {
      await ref.update(table, editId, editNom)
      setEditId(null)
      refetch()
    } catch (err) {
      setEditError(err.message)
    }
  }

  async function handleSupprimer(id) {
    try {
      await ref.remove(table, id)
      refetch()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-5 py-4 border-b border-gray-100 font-medium text-gray-700">{label}</div>
      {loading && <Spinner />}
      {error && <div className="p-4"><ErrorMessage message={error} /></div>}
      {!loading && !error && (
        <>
          <ul className="divide-y divide-gray-100">
            {liste?.length === 0 && (
              <li className="px-5 py-3 text-sm text-gray-400">Aucune entrée</li>
            )}
            {liste?.map(item => (
              <li key={item.id} className="px-5 py-2 flex items-center gap-2">
                {editId === item.id ? (
                  <form onSubmit={handleRenommer} className="flex flex-1 items-center gap-2">
                    <input value={editNom} onChange={e => setEditNom(e.target.value)} autoFocus required
                      className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none" />
                    {editError && <span className="text-red-500 text-xs">{editError}</span>}
                    <button type="submit" className="text-blue-600 hover:underline text-xs">OK</button>
                    <button type="button" onClick={() => setEditId(null)} className="text-gray-400 hover:underline text-xs">Annuler</button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{item.nom}</span>
                    <button onClick={() => startEdit(item)} className="text-gray-400 hover:text-blue-600 text-xs">Renommer</button>
                    <button onClick={() => handleSupprimer(item.id)} className="text-gray-400 hover:text-red-500 text-xs">Supprimer</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 border-t border-gray-100">
            <form onSubmit={handleAjouter} className="flex gap-2">
              <input value={nouveauNom} onChange={e => setNouveauNom(e.target.value)} placeholder="Nouvelle entrée..." required
                className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" disabled={adding || !nouveauNom.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm">
                {adding ? '...' : '+ Ajouter'}
              </button>
            </form>
            {addError && <p className="text-red-500 text-xs mt-1">{addError}</p>}
          </div>
        </>
      )}
    </div>
  )
}

export default function Referentiels() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Référentiels</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TABLES.map(t => <TableRef key={t.key} table={t.key} label={t.label} />)}
      </div>
    </div>
  )
}
