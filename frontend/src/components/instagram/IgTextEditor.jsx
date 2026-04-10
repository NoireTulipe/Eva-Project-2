/**
 * IgTextEditor — Modale d'édition de texte riche
 * Ouvre en double-cliquant sur un élément texte du canvas.
 * Gère : texte multiligne, gras, italique, alignement, taille, couleur.
 * Limite Konva : le style s'applique à tout l'élément (pas mot par mot).
 */
import { useState, useEffect, useRef } from 'react'

export default function IgTextEditor({ element, onChange, onClose }) {
  const [text, setText]         = useState(element.text ?? '')
  const [fontSize, setFontSize] = useState(element.fontSize ?? 32)
  const [fill, setFill]         = useState(element.fill ?? '#000000')
  const [align, setAlign]       = useState(element.align ?? 'left')
  const [fontStyle, setFontStyle] = useState(element.fontStyle ?? '')
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  function toggleStyle(style) {
    setFontStyle(prev => {
      const has  = prev.includes(style)
      const next = has
        ? prev.replace(style, '').trim()
        : (prev + ' ' + style).trim()
      return next
    })
  }

  function apply() {
    onChange({ text, fontSize, fill, align, fontStyle })
    onClose()
  }

  const isBold   = fontStyle.includes('bold')
  const isItalic = fontStyle.includes('italic')

  // Aperçu en temps réel
  const previewStyle = {
    fontFamily: element.fontFamily ?? 'Arial',
    fontSize:   Math.min(fontSize, 28),
    color:       fill,
    textAlign:   align,
    fontWeight:  isBold   ? 'bold'   : 'normal',
    fontStyle:   isItalic ? 'italic' : 'normal',
    lineHeight:  1.3,
    whiteSpace:  'pre-wrap',
    wordBreak:   'break-word',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Éditer le texte</span>
            {element.nom && (
              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs rounded font-medium">
                {element.nom}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Barre d'outils */}
        <div className="flex items-center gap-1 px-3 py-2 border-b bg-gray-50 flex-shrink-0 flex-wrap">
          {/* Gras / Italique */}
          <button
            onClick={() => toggleStyle('bold')}
            className={`w-8 h-8 text-sm font-bold rounded border transition-colors ${
              isBold ? 'bg-gray-800 text-white border-gray-800' : 'hover:bg-gray-100 border-gray-200'
            }`}
          >B</button>
          <button
            onClick={() => toggleStyle('italic')}
            className={`w-8 h-8 text-sm italic rounded border transition-colors ${
              isItalic ? 'bg-gray-800 text-white border-gray-800' : 'hover:bg-gray-100 border-gray-200'
            }`}
          >I</button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Alignement */}
          {[
            { val: 'left',   icon: '⬅' },
            { val: 'center', icon: '↔' },
            { val: 'right',  icon: '➡' },
          ].map(a => (
            <button key={a.val} onClick={() => setAlign(a.val)}
              className={`w-8 h-8 text-xs rounded border transition-colors ${
                align === a.val ? 'bg-gray-800 text-white border-gray-800' : 'hover:bg-gray-100 border-gray-200'
              }`}
            >{a.icon}</button>
          ))}

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Taille */}
          <div className="flex items-center gap-1">
            <button onClick={() => setFontSize(s => Math.max(8, s - 2))}
              className="w-6 h-8 text-sm border rounded hover:bg-gray-100 border-gray-200">−</button>
            <input type="number" value={fontSize} min={8} max={200}
              onChange={e => setFontSize(parseInt(e.target.value) || 32)}
              className="w-12 text-center border rounded text-xs py-1 border-gray-200" />
            <button onClick={() => setFontSize(s => Math.min(200, s + 2))}
              className="w-6 h-8 text-sm border rounded hover:bg-gray-100 border-gray-200">+</button>
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Couleur */}
          <input type="color" value={fill} onChange={e => setFill(e.target.value)}
            className="w-8 h-8 cursor-pointer rounded border border-gray-200 p-0.5" />
        </div>

        {/* Textarea */}
        <div className="p-4 flex-1 overflow-y-auto">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-pink-300"
            rows={5}
            placeholder="Votre texte…"
          />
        </div>

        {/* Aperçu */}
        <div className="px-4 pb-2 flex-shrink-0">
          <p className="text-xs text-gray-400 mb-1">Aperçu</p>
          <div className="bg-gray-800 rounded-lg px-4 py-3 min-h-12">
            <p style={previewStyle}>{text || 'Votre texte…'}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={apply}
            className="px-4 py-2 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 font-medium">
            Appliquer
          </button>
        </div>
      </div>
    </div>
  )
}
