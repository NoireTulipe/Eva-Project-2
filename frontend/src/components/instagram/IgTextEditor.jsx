/**
 * IgTextEditor — Palette d'édition de texte flottante et déplaçable
 * - Pas de fond bloquant
 * - Preview en direct sur le canvas (onChange immédiat)
 * - Annuler restaure les valeurs originales
 */
import { useState, useEffect, useRef } from 'react'

export default function IgTextEditor({ element, onChange, onClose }) {
  // Snapshot des valeurs originales pour restauration sur annulation
  const original = useRef({
    text:      element.text      ?? '',
    fontSize:  element.fontSize  ?? 32,
    fill:      element.fill      ?? '#000000',
    align:     element.align     ?? 'left',
    fontStyle: element.fontStyle ?? '',
  })

  const [text, setText]           = useState(original.current.text)
  const [fontSize, setFontSize]   = useState(original.current.fontSize)
  const [fill, setFill]           = useState(original.current.fill)
  const [align, setAlign]         = useState(original.current.align)
  const [fontStyle, setFontStyle] = useState(original.current.fontStyle)

  // Drag
  const panelRef  = useRef(null)
  const dragging  = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0 })
  const [pos, setPos] = useState({ left: window.innerWidth / 2 - 180, top: 80 })

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging.current) return
      setPos({
        left: dragStart.current.left + e.clientX - dragStart.current.x,
        top:  dragStart.current.top  + e.clientY - dragStart.current.y,
      })
    }
    function onMouseUp() { dragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',  onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',  onMouseUp)
    }
  }, [])

  function startDrag(e) {
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, left: pos.left, top: pos.top }
  }

  // Propagation immédiate vers le canvas
  function apply(patch) {
    const next = { text, fontSize, fill, align, fontStyle, ...patch }
    setText(next.text); setFontSize(next.fontSize); setFill(next.fill)
    setAlign(next.align); setFontStyle(next.fontStyle)
    onChange(patch)
  }

  function toggleStyle(style) {
    const has  = fontStyle.includes(style)
    const next = has ? fontStyle.replace(style, '').trim() : (fontStyle + ' ' + style).trim()
    apply({ fontStyle: next })
  }

  function cancel() {
    onChange(original.current) // restaure
    onClose()
  }

  function confirm() {
    onClose() // les valeurs sont déjà appliquées en live
  }

  const isBold   = fontStyle.includes('bold')
  const isItalic = fontStyle.includes('italic')

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 w-72 select-none"
      style={{ left: pos.left, top: pos.top }}
    >
      {/* Handle déplaçable */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b cursor-grab active:cursor-grabbing bg-gray-50 rounded-t-xl"
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">⠿</span>
          <span className="text-xs font-semibold text-gray-600">
            {element.nom ? `Texte — ${element.nom}` : 'Éditer le texte'}
          </span>
        </div>
        <button onClick={cancel} className="text-gray-400 hover:text-gray-600 text-base leading-none">✕</button>
      </div>

      <div className="p-3 space-y-3">
        {/* Barre de style */}
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => toggleStyle('bold')}
            className={`w-7 h-7 text-xs font-bold rounded border transition-colors ${
              isBold ? 'bg-gray-800 text-white border-gray-800' : 'hover:bg-gray-100 border-gray-200'
            }`}>B</button>
          <button onClick={() => toggleStyle('italic')}
            className={`w-7 h-7 text-xs italic rounded border transition-colors ${
              isItalic ? 'bg-gray-800 text-white border-gray-800' : 'hover:bg-gray-100 border-gray-200'
            }`}>I</button>

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          {[{ val: 'left', icon: '⬅' }, { val: 'center', icon: '↔' }, { val: 'right', icon: '➡' }].map(a => (
            <button key={a.val} onClick={() => apply({ align: a.val })}
              className={`w-7 h-7 text-xs rounded border transition-colors ${
                align === a.val ? 'bg-gray-800 text-white border-gray-800' : 'hover:bg-gray-100 border-gray-200'
              }`}>{a.icon}</button>
          ))}

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          <button onClick={() => apply({ fontSize: Math.max(8, fontSize - 2) })}
            className="w-6 h-7 text-sm border rounded hover:bg-gray-100 border-gray-200">−</button>
          <input type="number" value={fontSize} min={8} max={200}
            onChange={e => apply({ fontSize: parseInt(e.target.value) || 32 })}
            className="w-11 text-center border rounded text-xs py-1 border-gray-200" />
          <button onClick={() => apply({ fontSize: Math.min(200, fontSize + 2) })}
            className="w-6 h-7 text-sm border rounded hover:bg-gray-100 border-gray-200">+</button>

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          <input type="color" value={fill} onChange={e => apply({ fill: e.target.value })}
            className="w-7 h-7 cursor-pointer rounded border border-gray-200 p-0.5" />
        </div>

        {/* Textarea */}
        <textarea
          autoFocus
          value={text}
          onChange={e => apply({ text: e.target.value })}
          className="w-full border rounded px-2 py-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-pink-300"
          rows={4}
        />

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button onClick={cancel}
            className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={confirm}
            className="px-3 py-1.5 text-xs bg-pink-500 text-white rounded hover:bg-pink-600 font-medium">
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}
