import { useState } from 'react'
import IgBackgroundPicker from './IgBackgroundPicker.jsx'
import IgElementPicker    from './IgElementPicker.jsx'

export default function IgToolbar({
  onAddText, onAddImage, onSetBackground, background,
  onExport, onSave, saving, onShowIA, titre, onTitreChange,
}) {
  const [showBgPicker, setShowBgPicker]  = useState(false)
  const [showElPicker, setShowElPicker]  = useState(false)

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-wrap">
      {/* Titre */}
      <input
        type="text"
        value={titre}
        onChange={e => onTitreChange(e.target.value)}
        placeholder="Titre du post…"
        className="border rounded px-2 py-1 text-sm w-40"
      />

      <div className="w-px h-6 bg-gray-300" />

      {/* Outils */}
      <button
        onClick={onAddText}
        className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100"
        title="Ajouter un texte"
      >
        <span className="text-base">T</span>
        <span className="hidden sm:inline">Texte</span>
      </button>

      <div className="relative">
        <button
          onClick={() => setShowBgPicker(v => !v)}
          className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100"
          title="Fond"
        >
          <span
            className="w-4 h-4 rounded border border-gray-400 inline-block"
            style={background?.type === 'color' ? { background: background.value } : { background: '#ccc' }}
          />
          <span className="hidden sm:inline">Fond</span>
        </button>
        {showBgPicker && (
          <IgBackgroundPicker
            current={background}
            onSelect={bg => { onSetBackground(bg); setShowBgPicker(false) }}
            onClose={() => setShowBgPicker(false)}
          />
        )}
      </div>

      {/* Éléments */}
      <div className="relative">
        <button
          onClick={() => setShowElPicker(v => !v)}
          className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100"
          title="Ajouter un élément"
        >
          <span>⬛</span>
          <span className="hidden sm:inline">Éléments</span>
        </button>
        {showElPicker && (
          <IgElementPicker
            onAdd={onAddImage}
            onClose={() => setShowElPicker(false)}
          />
        )}
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* IA */}
      <button
        onClick={onShowIA}
        className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
      >
        ✦ Générer IA
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onExport}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          Exporter PNG
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}
