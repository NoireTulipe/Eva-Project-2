import { useState, useEffect } from 'react'
import { admin } from '../../../shared/api.js'

export default function Utilisateurs() {
  const [users, setUsers] = useState([])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    admin.getUtilisateurs().then(setUsers).catch(() => setError('Erreur chargement'))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const { id, ...data } = editing
      // N'envoie le mot de passe que s'il est renseigné
      if (!data.password) delete data.password
      const updated = await admin.updateUtilisateur(id, data)
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
      setEditing(null)
    } catch (e) {
      setError(e.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Utilisateurs</h1>

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-lg border border-gray-200 p-4">
            {editing?.id === u.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Prénom</label>
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={editing.prenom || ''}
                      onChange={e => setEditing(p => ({ ...p, prenom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Nom</label>
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={editing.nom || ''}
                      onChange={e => setEditing(p => ({ ...p, nom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={editing.email || ''}
                      onChange={e => setEditing(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Nouveau mot de passe</label>
                    <input
                      type="password"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Laisser vide pour ne pas changer"
                      value={editing.password || ''}
                      onChange={e => setEditing(p => ({ ...p, password: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <select
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none"
                      value={editing.role}
                      onChange={e => setEditing(p => ({ ...p, role: e.target.value }))}
                    >
                      <option value="admin">admin</option>
                      <option value="user">user</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={editing.actif}
                      onChange={() => setEditing(p => ({ ...p, actif: !p.actif }))}
                      className="accent-indigo-600"
                    />
                    Compte actif
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">
                    {u.prenom} {u.nom}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{u.email}</div>
                  <div className="flex gap-2 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.role}
                    </span>
                    {!u.actif && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">inactif</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setEditing({ ...u, password: '' })}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Modifier
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
