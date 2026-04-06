import { useState, useEffect } from 'react'
import { admin } from '../../shared/api.js'

const PROMPT_ROLES = [
  {
    role: 'texte_image',
    label: "Texte dans l'image",
    description: "Prompt pour générer le texte affiché sur les vignettes. Variables : {sujet}, {nbPhrases}, {nbSlides}",
  },
  {
    role: 'reponse_commentaire',
    label: 'Réponse aux commentaires',
    description: 'Prompt pour générer les réponses aux commentaires Instagram. Variables : {commentaire}, {auteur}',
  },
  {
    role: 'reponse_message',
    label: 'Réponse aux messages privés',
    description: 'Prompt pour générer les réponses aux messages directs. Variables : {message}, {expediteur}',
  },
]

export default function IgParametres() {
  const [prompts, setPrompts]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(null) // id du prompt en cours de sauvegarde
  const [saved, setSaved]       = useState(null) // id du prompt sauvegardé
  const [edits, setEdits]       = useState({})   // { [id]: contenu }

  useEffect(() => {
    admin.getPrompts().then(all => {
      const ig = all.filter(p => p.module === 'instagram')
      setPrompts(ig)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function getContenu(prompt) {
    return edits[prompt.id] ?? prompt.contenu
  }

  async function save(prompt) {
    setSaving(prompt.id)
    try {
      await admin.updatePrompt(prompt.id, { contenu: getContenu(prompt) })
      // Mettre à jour la valeur de référence
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, contenu: getContenu(prompt) } : p))
      setEdits(prev => { const n = { ...prev }; delete n[prompt.id]; return n })
      setSaved(prompt.id)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-400">Chargement…</div>
  }

  return (
    <div className="max-w-2xl p-4 space-y-6">
      <h2 className="text-base font-semibold">Paramètres Instagram</h2>
      <p className="text-sm text-gray-500">
        Les prompts sont stockés en base de données et partagés entre tous les utilisateurs.
      </p>

      {PROMPT_ROLES.map(({ role, label, description }) => {
        const prompt = prompts.find(p => p.role === role)
        if (!prompt) return (
          <div key={role} className="border rounded-lg p-4 bg-yellow-50">
            <p className="text-sm text-yellow-700">
              Prompt <code>{role}</code> introuvable — relancez le seed.
            </p>
          </div>
        )
        const contenu = getContenu(prompt)
        const isDirty = edits[prompt.id] !== undefined
        return (
          <div key={prompt.id} className="border rounded-lg p-4 space-y-3">
            <div>
              <h3 className="font-medium text-sm">{label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <textarea
              value={contenu}
              onChange={e => setEdits(prev => ({ ...prev, [prompt.id]: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm resize-y font-mono"
              rows={8}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => save(prompt)}
                disabled={saving === prompt.id || !isDirty}
                className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-40"
              >
                {saving === prompt.id ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
              {isDirty && (
                <button
                  onClick={() => setEdits(prev => { const n = { ...prev }; delete n[prompt.id]; return n })}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Annuler
                </button>
              )}
              {saved === prompt.id && (
                <span className="text-sm text-green-600">Sauvegardé ✓</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
