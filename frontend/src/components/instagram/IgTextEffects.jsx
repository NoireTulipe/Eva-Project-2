/**
 * IgTextEffects — Modale d'effets de texte
 *
 * Effets disponibles :
 *   - Ombre portée  : color, blur, offsetX, offsetY, opacity
 *   - Contour       : stroke color, strokeWidth
 *   - Texte 3D      : preset cascade d'ombres décalées + couleur de profondeur
 *
 * Toutes les propriétés sont stockées dans l'élément et lues par le canvas.
 */

import { useState } from 'react'

const PRESETS_3D = [
  { label: 'Noir',    depth: '#222222' },
  { label: 'Brique',  depth: '#8B2500' },
  { label: 'Marine',  depth: '#003366' },
  { label: 'Forêt',   depth: '#1a4a1a' },
  { label: 'Gold',    depth: '#7a5c00' },
  { label: 'Violet',  depth: '#3d0066' },
]

export default function IgTextEffects({ element, onChange, onClose }) {
  const [tab, setTab] = useState('ombre')

  // Valeurs courantes
  const shadow = element.shadow ?? {}
  const contour = element.contour ?? {}
  const effet3d = element.effet3d ?? {}

  function setShadow(props) {
    onChange({ shadow: { ...shadow, ...props } })
  }
  function setContour(props) {
    onChange({ contour: { ...contour, ...props } })
  }
  function setEffet3d(props) {
    onChange({ effet3d: { ...effet3d, ...props } })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-sm font-semibold">Effets de texte</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Onglets */}
        <div className="flex border-b">
          {[
            { id: 'ombre',   label: 'Ombre portée' },
            { id: 'contour', label: 'Contour' },
            { id: '3d',      label: 'Texte 3D' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">

          {/* ── Ombre portée ── */}
          {tab === 'ombre' && (
            <>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">Activer</span>
                <Toggle value={shadow.active ?? false} onChange={v => setShadow({ active: v })} />
              </label>

              <div className={shadow.active ? '' : 'opacity-40 pointer-events-none'}>
                <Row label="Couleur">
                  <input type="color" value={shadow.color ?? '#000000'}
                    onChange={e => setShadow({ color: e.target.value })}
                    className="w-10 h-7 border rounded cursor-pointer" />
                </Row>
                <Row label="Flou">
                  <SliderNum value={shadow.blur ?? 8} onChange={v => setShadow({ blur: v })} min={0} max={40} />
                </Row>
                <Row label="Décalage X">
                  <SliderNum value={shadow.offsetX ?? 4} onChange={v => setShadow({ offsetX: v })} min={-30} max={30} />
                </Row>
                <Row label="Décalage Y">
                  <SliderNum value={shadow.offsetY ?? 4} onChange={v => setShadow({ offsetY: v })} min={-30} max={30} />
                </Row>
                <Row label="Opacité">
                  <SliderNum value={shadow.opacity ?? 0.6} onChange={v => setShadow({ opacity: v })} min={0} max={1} step={0.05} />
                </Row>
              </div>

              {/* Prévisualisation */}
              <Preview text={element.text} fill={element.fill} fontFamily={element.fontFamily} fontSize={element.fontSize}
                style={shadow.active ? {
                  textShadow: `${shadow.offsetX ?? 4}px ${shadow.offsetY ?? 4}px ${shadow.blur ?? 8}px ${shadow.color ?? '#000'}`,
                  opacity: shadow.opacity ?? 0.8,
                } : {}} />
            </>
          )}

          {/* ── Contour ── */}
          {tab === 'contour' && (
            <>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">Activer</span>
                <Toggle value={contour.active ?? false} onChange={v => setContour({ active: v })} />
              </label>

              <div className={contour.active ? '' : 'opacity-40 pointer-events-none'}>
                <Row label="Couleur">
                  <input type="color" value={contour.color ?? '#000000'}
                    onChange={e => setContour({ color: e.target.value })}
                    className="w-10 h-7 border rounded cursor-pointer" />
                </Row>
                <Row label="Épaisseur">
                  <SliderNum value={contour.width ?? 2} onChange={v => setContour({ width: v })} min={0.5} max={10} step={0.5} />
                </Row>
              </div>

              <Preview text={element.text} fill={element.fill} fontFamily={element.fontFamily} fontSize={element.fontSize}
                style={contour.active ? {
                  WebkitTextStroke: `${contour.width ?? 2}px ${contour.color ?? '#000'}`,
                } : {}} />
            </>
          )}

          {/* ── 3D ── */}
          {tab === '3d' && (
            <>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">Activer</span>
                <Toggle value={effet3d.active ?? false} onChange={v => setEffet3d({ active: v })} />
              </label>

              <div className={effet3d.active ? '' : 'opacity-40 pointer-events-none'}>
                <Row label="Profondeur">
                  <SliderNum value={effet3d.depth ?? 5} onChange={v => setEffet3d({ depth: v })} min={1} max={20} />
                </Row>
                <Row label="Couleur profondeur">
                  <input type="color" value={effet3d.color ?? '#333333'}
                    onChange={e => setEffet3d({ color: e.target.value })}
                    className="w-10 h-7 border rounded cursor-pointer" />
                </Row>
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-2">Presets</p>
                  <div className="flex flex-wrap gap-1">
                    {PRESETS_3D.map(p => (
                      <button key={p.label} onClick={() => setEffet3d({ color: p.depth, active: true })}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs border rounded hover:bg-gray-50">
                        <span className="w-3 h-3 rounded-sm inline-block border"
                          style={{ background: p.depth }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prévisualisation CSS approx */}
              <Preview text={element.text} fill={element.fill} fontFamily={element.fontFamily} fontSize={element.fontSize}
                style={effet3d.active ? {
                  textShadow: build3dShadow(effet3d.depth ?? 5, effet3d.color ?? '#333333'),
                } : {}} />
            </>
          )}
        </div>

        <div className="px-5 pb-4 flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm bg-pink-500 text-white rounded hover:bg-pink-600">
            Appliquer
          </button>
        </div>
      </div>
    </div>
  )
}

// Génère une cascade d'ombres pour l'effet 3D
function build3dShadow(depth, color) {
  return Array.from({ length: Math.round(depth) }, (_, i) => {
    const d = i + 1
    return `${d}px ${d}px 0px ${color}`
  }).join(', ')
}

function Preview({ text, fill, fontFamily, fontSize, style }) {
  return (
    <div className="mt-3 bg-gray-800 rounded-lg p-4 flex items-center justify-center min-h-16">
      <span style={{
        fontFamily: fontFamily ?? 'Arial',
        fontSize: Math.min(fontSize ?? 32, 36),
        color: fill ?? '#ffffff',
        lineHeight: 1.2,
        display: 'block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...style,
      }}>
        {(text ?? 'Aperçu').slice(0, 30)}
      </span>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function SliderNum({ value, onChange, min, max, step = 1 }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1" />
      <span className="text-xs text-gray-600 w-8 text-right">{typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value}</span>
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-pink-500' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}
