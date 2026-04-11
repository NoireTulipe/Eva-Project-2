/**
 * IgCalendrier — Calendrier de planification EVA
 *
 * Permet de créer des entrées "sujet + template + date" qu'EVA traitera
 * automatiquement pour générer la vignette et la proposer sur Discord.
 */
import { useState, useEffect } from 'react'
import { instagram } from '../../shared/api.js'

const STATUT = {
  planifie:  { label: 'Planifié',    cls: 'bg-gray-100 text-gray-600' },
  en_cours:  { label: 'En cours…',  cls: 'bg-yellow-100 text-yellow-700' },
  propose:   { label: 'Proposé',    cls: 'bg-blue-100 text-blue-700' },
  valide:    { label: 'Validé ✅',   cls: 'bg-green-100 text-green-700' },
  publie:    { label: 'Publié',      cls: 'bg-green-200 text-green-800' },
  erreur:    { label: 'Erreur',      cls: 'bg-red-100 text-red-600' },
}

export default function IgCalendrier() {
  const [planifs, setPlanifs]       = useState([])
  const [templates, setTemplates]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [deleting, setDeleting]     = useState(null)

  // Formulaire
  const [fSujet, setFSujet]         = useState('')
  const [fTemplate, setFTemplate]   = useState('')
  const [fDate, setFDate]           = useState('')
  const [fSaving, setFSaving]       = useState(false)
  const [fError, setFError]         = useState(null)

  async function load() {
    setLoading(true)
    const [p, t] = await Promise.all([
      instagram.getPlanification().catch(() => []),
      instagram.getTemplates().catch(() => []),
    ])
    setPlanifs(p)
    setTemplates(t)
    if (t.length && !fTemplate) setFTemplate(String(t[0].id))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function creer() {
    setFError(null)
    if (!fSujet.trim()) return setFError('Sujet requis')
    if (!fTemplate) return setFError('Sélectionne un template')
    if (!fDate) return setFError('Date requise')
    setFSaving(true)
    try {
      await instagram.createPlanification({ templateId: Number(fTemplate), sujet: fSujet, datePost: fDate })
      setFSujet('')
      setFDate('')
      setShowForm(false)
      await load()
    } catch (e) {
      setFError(e.message)
    } finally {
      setFSaving(false)
    }
  }

  async function supprimer(id) {
    if (!window.confirm('Supprimer cette planification ?')) return
    setDeleting(id)
    await instagram.deletePlanification(id).catch(() => {})
    await load()
    setDeleting(null)
  }

  // Grouper par semaine
  const grouped = planifs.reduce((acc, p) => {
    const d    = new Date(p.datePost)
    const week = getWeekLabel(d)
    if (!acc[week]) acc[week] = []
    acc[week].push(p)
    return acc
  }, {})

  return (
    <div className="h-full overflow-y-auto p-4 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Calendrier de posts</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            EVA génère les vignettes automatiquement et te les propose sur Discord pour validation.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 font-medium">
          + Planifier un post
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="border border-pink-200 rounded-xl p-4 bg-pink-50 space-y-3">
          <h3 className="text-sm font-semibold text-pink-700">Nouveau post planifié</h3>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Template à utiliser</label>
            {templates.length === 0 ? (
              <p className="text-xs text-orange-600">
                Aucun template disponible — crée une vignette dans l'Éditeur et marque-la comme template (📐 Template).
              </p>
            ) : (
              <select value={fTemplate} onChange={e => setFTemplate(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm bg-white">
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.titre || `Template #${t.id}`} — {t.format}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Sujet / instruction pour EVA
            </label>
            <textarea
              value={fSujet}
              onChange={e => setFSujet(e.target.value)}
              placeholder="Ex : Mettre en avant notre nouveau roman policier, ton mystérieux et intrigant…"
              className="w-full border rounded px-3 py-2 text-sm resize-y bg-white"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date de publication prévue</label>
            <input type="datetime-local" value={fDate} onChange={e => setFDate(e.target.value)}
              className="border rounded px-3 py-2 text-sm bg-white" />
          </div>

          {fError && <p className="text-xs text-red-600">{fError}</p>}

          <div className="flex gap-2">
            <button onClick={creer} disabled={fSaving || templates.length === 0}
              className="px-4 py-2 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-50">
              {fSaving ? 'Enregistrement…' : 'Planifier'}
            </button>
            <button onClick={() => { setShowForm(false); setFError(null) }}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
              Annuler
            </button>
          </div>

          <p className="text-xs text-gray-400">
            EVA traitera ce post 24h avant la date prévue et t'enverra la vignette sur Discord pour validation.
          </p>
        </div>
      )}

      {/* Liste par semaine */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Chargement…</p>
      ) : planifs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-sm font-medium">Aucun post planifié</p>
          <p className="text-xs mt-1">Clique sur "+ Planifier un post" pour commencer.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([week, items]) => (
          <div key={week}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{week}</p>
            <div className="space-y-2">
              {items.map(p => {
                const st = STATUT[p.statut] ?? STATUT.planifie
                const tmpl = templates.find(t => t.id === p.templateId)
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 border rounded-xl bg-white hover:shadow-sm transition-shadow">
                    {/* Date */}
                    <div className="flex-shrink-0 text-center w-12">
                      <p className="text-lg font-bold text-gray-800 leading-none">
                        {new Date(p.datePost).getDate()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.datePost).toLocaleDateString('fr-FR', { month: 'short' })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.datePost).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.sujet}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Template : {tmpl?.titre || `#${p.templateId}`}
                        {p.legende && ` · ${p.legende.slice(0, 50)}…`}
                      </p>
                      {p.erreur && (
                        <p className="text-xs text-red-500 mt-0.5">⚠ {p.erreur}</p>
                      )}
                    </div>

                    {/* Statut + actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                      {(p.statut === 'planifie' || p.statut === 'erreur') && (
                        <button onClick={() => supprimer(p.id)} disabled={deleting === p.id}
                          className="text-gray-300 hover:text-red-400 text-lg leading-none disabled:opacity-40">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function getWeekLabel(date) {
  const now     = new Date()
  const startOfWeek = d => {
    const d2 = new Date(d)
    d2.setDate(d2.getDate() - d2.getDay() + 1)
    d2.setHours(0, 0, 0, 0)
    return d2
  }
  const thisWeek = startOfWeek(now)
  const nextWeek = new Date(thisWeek); nextWeek.setDate(nextWeek.getDate() + 7)
  const w        = startOfWeek(date)

  if (w.getTime() === thisWeek.getTime()) return 'Cette semaine'
  if (w.getTime() === nextWeek.getTime()) return 'Semaine prochaine'

  return `Semaine du ${w.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
}
