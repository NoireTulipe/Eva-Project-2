import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ref } from '../../shared/api.js'

/**
 * SelectRef — select peuplé depuis une table référentiel + bouton [+] pour
 * ajouter une entrée à la volée. L'entrée créée est automatiquement sélectionnée.
 *
 * La modale est rendue via un Portal dans document.body pour éviter le problème
 * des formulaires HTML imbriqués (le navigateur ignore les <form> imbriqués).
 *
 * Props :
 *   table      — clé de la table (ex: 'categories', 'methodes-paiement')
 *   value      — valeur contrôlée (id numérique ou '')
 *   onChange   — appelé avec le nouvel id numérique (ou '')
 *   label      — optionnel, affiché dans le placeholder et la modale
 *   required   — passe l'attribut required au select
 *   className  — classes additionnelles pour le select
 */
export default function SelectRef({ table, value, onChange, label = '', required = false, className = '' }) {
  const [liste, setListe] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [nom, setNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    ref.getAll(table).then(setListe).catch(() => setListe([]))
  }, [table])

  useEffect(() => {
    if (modalOpen) {
      setNom('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [modalOpen])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const entry = await ref.create(table, nom)
      setListe(prev => [...prev, entry].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
      onChange(entry.id)
      setModalOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const modal = modalOpen ? createPortal(
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
      onKeyDown={e => { if (e.key === 'Escape') setModalOpen(false) }}
    >
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-800 mb-4">
          Ajouter {label ? `— ${label}` : ''}
        </h3>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Nom"
            required
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !nom.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm"
            >
              {saving ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="flex gap-1 items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        required={required}
        className={`flex-1 border border-gray-300 rounded px-3 py-2 text-sm ${className}`}
      >
        <option value="">{label ? `-- ${label} --` : '-- Choisir --'}</option>
        {liste.map(item => (
          <option key={item.id} value={item.id}>{item.nom}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title={`Ajouter ${label || 'une entrée'}`}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors text-lg leading-none"
      >
        +
      </button>

      {modal}
    </div>
  )
}
