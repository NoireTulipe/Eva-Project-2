import { useState } from 'react'
import { IG_FORMATS } from './igFormats.js'
import IgBackgroundPicker from './IgBackgroundPicker.jsx'
import IgElementPicker    from './IgElementPicker.jsx'

export default function IgToolbar({
  format, onFormatChange,
  onAddText, onAddImage, onSetBackground, background,
  onExport, onSave, saving, onShowIA, onShowProg, onPublierMaintenant,
  titre, onTitreChange,
}) {
  const [showBgPicker, setShowBgPicker]  = useState(false)
  const [showElPicker, setShowElPicker]  = useState(false)
  const [showFormats, setShowFormats]    = useState(false)

  const fmt = IG_FORMATS[format]

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-wrap">

      {/* Titre */}
      <input
        type="text"
        value={titre}
        onChange={e => onTitreChange(e.target.value)}
        placeholder="Titre du post…"
        className="border rounded px-2 py-1 text-sm w-36"
      />

      <div className="w-px h-6 bg-gray-300" />

      {/* Sélecteur de format */}
      <div className="relative">
        <button
          onClick={() => setShowFormats(v => !v)}
          className="flex items-center gap-1.5 px-2 py-1 text-sm border rounded hover:bg-gray-50"
          title="Format"
        >
          <FormatIcon format={format} />
          <span className="hidden sm:inline">{fmt.label}</span>
          <span className="text-gray-400 text-xs">▾</span>
        </button>
        {showFormats && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border rounded shadow-lg w-52">
            {Object.values(IG_FORMATS).map(f => (
              <button
                key={f.id}
                onClick={() => { onFormatChange(f.id); setShowFormats(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 ${format === f.id ? 'bg-pink-50 text-pink-600 font-medium' : ''}`}
              >
                <FormatIcon format={f.id} />
                <div className="text-left">
                  <p className="font-medium">{f.label}</p>
                  <p className="text-xs text-gray-400">{f.exportW}×{f.exportH} — {f.subtitle}</p>
                </div>
                {format === f.id && <span className="ml-auto text-pink-500">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* Texte */}
      <button onClick={onAddText} className="px-2 py-1 text-sm rounded hover:bg-gray-100 font-bold" title="Ajouter texte">
        T
      </button>

      {/* Fond */}
      <div className="relative">
        <button onClick={() => setShowBgPicker(v => !v)} className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100" title="Fond">
          <span className="w-4 h-4 rounded border border-gray-400 inline-block"
            style={background?.type === 'color' ? { background: background.value } : { background: '#ccc' }} />
          <span className="hidden sm:inline">Fond</span>
        </button>
        {showBgPicker && (
          <IgBackgroundPicker current={background} onSelect={bg => { onSetBackground(bg); setShowBgPicker(false) }} onClose={() => setShowBgPicker(false)} />
        )}
      </div>

      {/* Éléments */}
      <div className="relative">
        <button onClick={() => setShowElPicker(v => !v)} className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100" title="Éléments">
          ⬛ <span className="hidden sm:inline">Éléments</span>
        </button>
        {showElPicker && (
          <IgElementPicker onAdd={onAddImage} onClose={() => setShowElPicker(false)} />
        )}
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* IA */}
      <button onClick={onShowIA} className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100">
        ✦ IA
      </button>

      {/* Actions publication — à droite */}
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onExport} className="px-2 py-1 text-sm border rounded hover:bg-gray-50 hidden sm:block">
          PNG
        </button>
        <button onClick={onSave} disabled={saving} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">
          {saving ? '…' : 'Sauv.'}
        </button>
        <button onClick={onShowProg} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
          🕐 Programmer
        </button>
        <button onClick={onPublierMaintenant} className="px-3 py-1 text-sm bg-pink-500 text-white rounded hover:bg-pink-600">
          Publier
        </button>
      </div>
    </div>
  )
}

function FormatIcon({ format }) {
  const icons = { portrait: '▯', carre: '◻', paysage: '▭', story: '▯' }
  const styles = {
    portrait: { fontSize: '16px' },
    carre:    { fontSize: '14px' },
    paysage:  { fontSize: '10px', letterSpacing: '-1px' },
    story:    { fontSize: '18px' },
  }
  return <span style={styles[format]} className="text-gray-600 leading-none">{icons[format]}</span>
}
