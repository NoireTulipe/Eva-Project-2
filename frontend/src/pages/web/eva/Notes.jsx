import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { notes as notesApi, admin } from '../../../shared/api.js'

// ─── Couleurs de fond disponibles ────────────────────────────────────────────

const COULEURS_FOND = [
  { value: '#fef08a', label: 'Jaune' },
  { value: '#fbcfe8', label: 'Rose' },
  { value: '#bbf7d0', label: 'Vert' },
  { value: '#bae6fd', label: 'Bleu' },
  { value: '#fed7aa', label: 'Orange' },
  { value: '#ddd6fe', label: 'Lavande' },
]

// ─── Utilitaires temps ────────────────────────────────────────────────────────

function formatCountdown(date) {
  if (!date) return null
  const diff = new Date(date) - Date.now()
  if (diff <= 0) return null
  const s = Math.floor(diff / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}j ${h % 24}h`
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

function formatDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Rotation légèrement aléatoire mais stable par id
function getRotation(id) {
  const angles = [-2.5, -1.5, -0.8, 0, 0.8, 1.5, 2.5, -2, 1, -1]
  return angles[id % angles.length]
}

// ─── Composant PostIt ─────────────────────────────────────────────────────────

function PostIt({ note, police, onEdit, onDelete }) {
  const [rappelStr, setRappelStr] = useState(() => formatCountdown(note.rappelAt))
  const [expiStr, setExpiStr] = useState(() => formatCountdown(note.expirationAt))

  useEffect(() => {
    const t = setInterval(() => {
      setRappelStr(formatCountdown(note.rappelAt))
      setExpiStr(formatCountdown(note.expirationAt))
    }, 30000)
    return () => clearInterval(t)
  }, [note.rappelAt, note.expirationAt])

  const rotation = getRotation(note.id)

  return (
    <div
      className="relative group rounded-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:z-10 flex flex-col"
      style={{
        backgroundColor: note.couleurFond,
        transform: `rotate(${rotation}deg)`,
        minHeight: '180px',
        fontFamily: police ? `'${police}', cursive` : 'inherit',
      }}
    >
      {/* Bande du haut façon post-it */}
      <div
        className="h-7 rounded-t-sm flex-shrink-0"
        style={{ backgroundColor: adjustBrightness(note.couleurFond, -15) }}
      />

      {/* Boutons action (visibles au hover) */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {/* Éditer */}
        <button
          onClick={() => onEdit(note)}
          title="Modifier"
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shadow-md transition-transform hover:scale-110"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
        >
          ✏️
        </button>
        {/* Supprimer */}
        <button
          onClick={() => onDelete(note)}
          title="Supprimer"
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shadow-md transition-transform hover:scale-110"
          style={{ backgroundColor: 'rgba(220,38,38,0.7)' }}
        >
          ×
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 px-4 py-3 overflow-hidden">
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={{ color: note.couleurTexte }}
        >
          {note.contenu}
        </p>
      </div>

      {/* Pied discret — compte à rebours */}
      {(rappelStr || expiStr) && (
        <div className="px-3 pb-2 flex flex-col gap-0.5">
          {rappelStr && (
            <span className="text-xs opacity-50" style={{ color: note.couleurTexte }}>
              🔔 {rappelStr}
            </span>
          )}
          {expiStr && (
            <span className="text-xs opacity-50" style={{ color: note.couleurTexte }}>
              ⏳ {expiStr}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Assombrit ou éclaircit une couleur hex
function adjustBrightness(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// ─── Modale Ajout / Édition ───────────────────────────────────────────────────

const FORM_VIDE = {
  contenu: '',
  couleurFond: '#fef08a',
  couleurTexte: '#1f2937',
  rappelAt: '',
  expirationAt: '',
}

function ModalNote({ note, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    note
      ? {
          contenu: note.contenu,
          couleurFond: note.couleurFond,
          couleurTexte: note.couleurTexte,
          rappelAt: formatDatetimeLocal(note.rappelAt),
          expirationAt: formatDatetimeLocal(note.expirationAt),
        }
      : { ...FORM_VIDE }
  )
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.contenu.trim()) return
    setSaving(true)
    try {
      await onSave({
        contenu: form.contenu,
        couleurFond: form.couleurFond,
        couleurTexte: form.couleurTexte,
        rappelAt: form.rappelAt || null,
        expirationAt: form.expirationAt || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: form.couleurFond }}
      >
        {/* En-tête colorée */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ backgroundColor: adjustBrightness(form.couleurFond, -20) }}
        >
          <h2
            className="font-semibold text-base"
            style={{ color: form.couleurTexte }}
          >
            {note ? 'Modifier la note' : 'Nouvelle note'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold transition-opacity hover:opacity-70"
            style={{ color: form.couleurTexte }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20 bg-white/40 placeholder-black/30"
            style={{ color: form.couleurTexte, fontFamily: 'inherit', minHeight: '120px' }}
            placeholder="Écris ta note…"
            value={form.contenu}
            onChange={e => setForm(p => ({ ...p, contenu: e.target.value }))}
          />

          {/* Couleur de fond — boutons ronds */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide opacity-60 block mb-2"
              style={{ color: form.couleurTexte }}>
              Couleur du post-it
            </label>
            <div className="flex gap-2 flex-wrap">
              {COULEURS_FOND.map(c => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setForm(p => ({ ...p, couleurFond: c.value }))}
                  className="w-8 h-8 rounded-full border-4 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: form.couleurFond === c.value ? form.couleurTexte : 'transparent',
                    boxShadow: form.couleurFond === c.value ? `0 0 0 2px ${adjustBrightness(c.value, -40)}` : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Couleur du texte */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide opacity-60"
              style={{ color: form.couleurTexte }}>
              Couleur du texte
            </label>
            <input
              type="color"
              value={form.couleurTexte}
              onChange={e => setForm(p => ({ ...p, couleurTexte: e.target.value }))}
              className="w-9 h-9 rounded-full cursor-pointer border-2 border-white/60 shadow"
              style={{ backgroundColor: form.couleurTexte }}
            />
          </div>

          {/* Rappel */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide opacity-60 block mb-1"
              style={{ color: form.couleurTexte }}>
              🔔 Rappel (optionnel)
            </label>
            <input
              type="datetime-local"
              value={form.rappelAt}
              onChange={e => setForm(p => ({ ...p, rappelAt: e.target.value }))}
              className="w-full rounded-lg px-3 py-1.5 text-sm bg-white/40 focus:outline-none focus:ring-2 focus:ring-black/20"
              style={{ color: form.couleurTexte }}
            />
          </div>

          {/* Expiration */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide opacity-60 block mb-1"
              style={{ color: form.couleurTexte }}>
              ⏳ Expiration automatique (optionnel)
            </label>
            <input
              type="datetime-local"
              value={form.expirationAt}
              onChange={e => setForm(p => ({ ...p, expirationAt: e.target.value }))}
              className="w-full rounded-lg px-3 py-1.5 text-sm bg-white/40 focus:outline-none focus:ring-2 focus:ring-black/20"
              style={{ color: form.couleurTexte }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-medium bg-white/40 hover:bg-white/60 transition-colors"
              style={{ color: form.couleurTexte }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !form.contenu.trim()}
              className="flex-1 py-2 rounded-xl text-sm font-semibold shadow transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{
                backgroundColor: adjustBrightness(form.couleurFond, -40),
                color: '#fff'
              }}
            >
              {saving ? '…' : note ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ─── Modal de confirmation suppression ───────────────────────────────────────

function ModalConfirmSuppr({ note, onConfirm, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Supprimer ce post-it ?</h3>
        <p className="text-sm text-gray-500 line-clamp-3">
          {note.contenu.slice(0, 100)}{note.contenu.length > 100 ? '…' : ''}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Notes() {
  const [notesList, setNotesList] = useState([])
  const [police, setPolice] = useState('Caveat')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [noteEdit, setNoteEdit] = useState(null)       // null = nouvelle, objet = édition
  const [noteASupprimer, setNoteASupprimer] = useState(null)

  // Charger les notes + la police configurée
  useEffect(() => {
    Promise.all([
      notesApi.getAll(),
      admin.getConfig()
    ]).then(([data, config]) => {
      setNotesList(data)
      const param = config.find(p => p.cle === 'notes.police')
      if (param?.valeur) setPolice(param.valeur)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Injecter la Google Font dynamiquement
  useEffect(() => {
    if (!police) return
    const id = 'google-font-notes'
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(police)}:wght@400;700&display=swap`
    document.head.appendChild(link)
  }, [police])

  async function handleSave(data) {
    if (noteEdit) {
      const updated = await notesApi.update(noteEdit.id, data)
      setNotesList(prev => prev.map(n => n.id === updated.id ? updated : n))
    } else {
      const created = await notesApi.create(data)
      setNotesList(prev => [created, ...prev])
    }
  }

  async function handleDelete() {
    if (!noteASupprimer) return
    await notesApi.remove(noteASupprimer.id)
    setNotesList(prev => prev.filter(n => n.id !== noteASupprimer.id))
    setNoteASupprimer(null)
  }

  function ouvrirNouvelle() {
    setNoteEdit(null)
    setModalOpen(true)
  }

  function ouvrirEdition(note) {
    setNoteEdit(note)
    setModalOpen(true)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #ede8de 100%)' }}>

      {/* En-tête */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notes & Rappels</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {notesList.length === 0
              ? 'Aucune note pour le moment'
              : `${notesList.length} note${notesList.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Bouton + */}
        <button
          onClick={ouvrirNouvelle}
          className="w-12 h-12 rounded-full bg-indigo-600 text-white text-2xl font-light shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center"
          title="Nouvelle note"
        >
          +
        </button>
      </div>

      {/* Mur de post-its */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : notesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
          <span className="text-6xl">📌</span>
          <p className="text-gray-500 text-sm">Clique sur + pour ajouter ta première note</p>
        </div>
      ) : (
        <div
          className="px-6 pb-8"
          style={{
            columns: 'auto',
            columnWidth: '220px',
            columnGap: '1.5rem',
          }}
        >
          {notesList.map(note => (
            <div key={note.id} className="mb-5 break-inside-avoid">
              <PostIt
                note={note}
                police={police}
                onEdit={ouvrirEdition}
                onDelete={setNoteASupprimer}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modales */}
      {modalOpen && (
        <ModalNote
          note={noteEdit}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setNoteEdit(null) }}
        />
      )}

      {noteASupprimer && (
        <ModalConfirmSuppr
          note={noteASupprimer}
          onConfirm={handleDelete}
          onClose={() => setNoteASupprimer(null)}
        />
      )}
    </div>
  )
}
