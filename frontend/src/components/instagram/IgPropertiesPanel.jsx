import { useEffect, useState } from 'react'
import { instagram } from '../../shared/api.js'
import { loadGoogleFont } from './useGoogleFonts.js'
import IgTextEffects from './IgTextEffects.jsx'

export default function IgPropertiesPanel({ element, onChange, onDelete }) {
  const [fonts, setFonts]           = useState([])
  const [showEffects, setShowEffects] = useState(false)

  useEffect(() => {
    instagram.getFonts().then(fs => {
      setFonts(fs)
      // Pré-charger toutes les Google Fonts de la bibliothèque
      fs.forEach(f => { if (f.googleFont) loadGoogleFont(f.googleFont) })
    }).catch(() => {})
  }, [])

  if (!element) {
    return (
      <div className="w-52 flex-shrink-0 bg-white border-l border-gray-200 p-3 flex items-start">
        <p className="text-xs text-gray-400">Sélectionnez un élément</p>
      </div>
    )
  }

  return (
    <div className="w-52 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b flex justify-between items-center">
        Propriétés
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-base">✕</button>
      </div>

      <div className="p-3 space-y-3">

        {/* Position */}
        <Section label="Position">
          <Row label="X">
            <NumInput value={element.x} onChange={v => onChange({ x: v })} />
          </Row>
          <Row label="Y">
            <NumInput value={element.y} onChange={v => onChange({ y: v })} />
          </Row>
          <Row label="Rotation">
            <NumInput value={element.rotation ?? 0} onChange={v => onChange({ rotation: v })} />
          </Row>
          <Row label="Opacité">
            <input
              type="range" min="0" max="1" step="0.05"
              value={element.opacity ?? 1}
              onChange={e => onChange({ opacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </Row>
        </Section>

        {/* Taille */}
        <Section label="Taille">
          <Row label="Largeur">
            <NumInput value={element.width} onChange={v => onChange({ width: v })} />
          </Row>
          {element.type === 'image' && (
            <Row label="Hauteur">
              <NumInput value={element.height} onChange={v => onChange({ height: v })} />
            </Row>
          )}
        </Section>

        {/* Texte */}
        {element.type === 'text' && (
          <Section label="Texte">
            <Row label="Nom">
              <input
                type="text"
                value={element.nom ?? ''}
                onChange={e => onChange({ nom: e.target.value })}
                placeholder="Ex : Titre, Accroche…"
                className="w-full border rounded px-2 py-0.5 text-xs"
              />
            </Row>
            <textarea
              value={element.text}
              onChange={e => onChange({ text: e.target.value })}
              className="w-full border rounded px-2 py-1 text-xs resize-none"
              rows={3}
            />
            <Row label="Taille">
              <NumInput value={element.fontSize} onChange={v => onChange({ fontSize: v })} min={8} max={200} />
            </Row>
            <Row label="Police">
              <select
                value={element.fontFamily}
                onChange={e => {
                  const nom = e.target.value
                  // Charger la Google Font correspondante si besoin
                  const f = fonts.find(f => f.nom === nom)
                  if (f?.googleFont) loadGoogleFont(f.googleFont)
                  onChange({ fontFamily: nom })
                }}
                className="w-full border rounded px-1 py-0.5 text-xs"
              >
                <optgroup label="Système">
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Times New Roman">Times New Roman</option>
                </optgroup>
                {fonts.length > 0 && (
                  <optgroup label="Bibliothèque">
                    {fonts.map(f => (
                      <option key={f.id} value={f.googleFont ?? f.nom}
                        style={{ fontFamily: f.googleFont ?? f.nom }}>
                        {f.nom}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Row>
            <Row label="Style">
              <div className="flex gap-1">
                {['bold', 'italic'].map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      const cur = element.fontStyle ?? ''
                      const has = cur.includes(s)
                      const next = has
                        ? cur.replace(s, '').trim()
                        : (cur + ' ' + s).trim()
                      onChange({ fontStyle: next })
                    }}
                    className={`px-2 py-0.5 text-xs border rounded ${
                      (element.fontStyle ?? '').includes(s)
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {s === 'bold' ? 'G' : 'I'}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Alignement">
              <div className="flex gap-1">
                {['left', 'center', 'right'].map(a => (
                  <button
                    key={a}
                    onClick={() => onChange({ align: a })}
                    className={`px-2 py-0.5 text-xs border rounded ${
                      element.align === a ? 'bg-gray-800 text-white' : 'hover:bg-gray-50'
                    }`}
                  >
                    {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Couleur">
              <input
                type="color"
                value={element.fill}
                onChange={e => onChange({ fill: e.target.value })}
                className="w-10 h-7 border rounded cursor-pointer"
              />
            </Row>
            <div className="pt-1">
              <button
                onClick={() => setShowEffects(true)}
                className="w-full py-1.5 text-xs border border-purple-200 text-purple-600 rounded hover:bg-purple-50 font-medium"
              >
                ✦ Effets de texte
                {(element.shadow?.active || element.contour?.active || element.effet3d?.active) && (
                  <span className="ml-1 text-pink-500">●</span>
                )}
              </button>
            </div>
          </Section>
        )}

        {showEffects && element.type === 'text' && (
          <IgTextEffects
            element={element}
            onChange={onChange}
            onClose={() => setShowEffects(false)}
          />
        )}

        {/* Forme */}
        {element.type === 'shape' && (
          <>
            <Section label="Forme">
              <Row label="Remplissage">
                <div className="flex items-center gap-2">
                  <Toggle value={element.fillEnabled !== false} onChange={v => onChange({ fillEnabled: v })} />
                  {element.fillEnabled !== false && (
                    <input type="color" value={element.fill ?? '#4f86f7'}
                      onChange={e => onChange({ fill: e.target.value })}
                      className="w-8 h-6 border rounded cursor-pointer" />
                  )}
                </div>
              </Row>
              <Row label="Bordure">
                <div className="flex items-center gap-2">
                  <NumInput value={element.strokeWidth ?? 0} onChange={v => onChange({ strokeWidth: v })} min={0} max={30} />
                  <input type="color" value={element.stroke ?? '#000000'}
                    onChange={e => onChange({ stroke: e.target.value })}
                    className="w-8 h-6 border rounded cursor-pointer" />
                </div>
              </Row>
              {element.shapeType === 'rect' && (
                <Row label="Arrondi">
                  <NumInput value={element.cornerRadius ?? 0} onChange={v => onChange({ cornerRadius: v })} min={0} max={300} />
                </Row>
              )}
              {(element.shapeType === 'rect') && (
                <Row label="Hauteur">
                  <NumInput value={element.height ?? 150} onChange={v => onChange({ height: v })} min={10} />
                </Row>
              )}
            </Section>

            <Section label="Ombre">
              <Row label="Activer">
                <Toggle value={element.shadowEnabled ?? false} onChange={v => onChange({ shadowEnabled: v })} />
              </Row>
              {element.shadowEnabled && (
                <>
                  <Row label="Couleur">
                    <input type="color" value={element.shadowColor ?? '#000000'}
                      onChange={e => onChange({ shadowColor: e.target.value })}
                      className="w-10 h-7 border rounded cursor-pointer" />
                  </Row>
                  <Row label="Flou">
                    <NumInput value={element.shadowBlur ?? 10} onChange={v => onChange({ shadowBlur: v })} min={0} max={60} />
                  </Row>
                  <Row label="Décal. X">
                    <NumInput value={element.shadowOffsetX ?? 5} onChange={v => onChange({ shadowOffsetX: v })} min={-50} max={50} />
                  </Row>
                  <Row label="Décal. Y">
                    <NumInput value={element.shadowOffsetY ?? 5} onChange={v => onChange({ shadowOffsetY: v })} min={-50} max={50} />
                  </Row>
                  <Row label="Opacité">
                    <input type="range" min="0" max="1" step="0.05"
                      value={element.shadowOpacity ?? 0.5}
                      onChange={e => onChange({ shadowOpacity: parseFloat(e.target.value) })}
                      className="w-full" />
                  </Row>
                </>
              )}
            </Section>
          </>
        )}

        {/* Image */}
        {element.type === 'image' && (
          <Section label="Image">
            <Row label="Flip H">
              <Toggle value={element.flipX} onChange={v => onChange({ flipX: v })} />
            </Row>
            <Row label="Flip V">
              <Toggle value={element.flipY} onChange={v => onChange({ flipY: v })} />
            </Row>
          </Section>
        )}

        {/* Flèche */}
        {element.type === 'arrow' && (
          <Section label="Flèche">
            <Row label="Couleur">
              <input type="color" value={element.stroke ?? '#000000'}
                onChange={e => onChange({ stroke: e.target.value })}
                className="w-10 h-7 border rounded cursor-pointer" />
            </Row>
            <Row label="Épaisseur">
              <NumInput value={element.strokeWidth ?? 3} onChange={v => onChange({ strokeWidth: v })} min={1} max={30} />
            </Row>
            <Row label="Pointe">
              <select value={element.arrowHead ?? 'end'} onChange={e => onChange({ arrowHead: e.target.value })}
                className="w-full border rounded px-1 py-0.5 text-xs">
                <option value="end">Fin seulement</option>
                <option value="start">Début seulement</option>
                <option value="both">Les deux</option>
                <option value="none">Aucune</option>
              </select>
            </Row>
            <Row label="Taille ↗">
              <NumInput value={element.arrowSize ?? 18} onChange={v => onChange({ arrowSize: v })} min={8} max={50} />
            </Row>
            <Row label="Tirets">
              <Toggle value={element.dash ?? false} onChange={v => onChange({ dash: v })} />
            </Row>
            <div className="pt-1">
              <p className="text-xs text-gray-400 italic">
                Déplacez les points roses (extrémités) et indigo (courbure) sur le canvas.
              </p>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, min, max }) {
  return (
    <input
      type="number"
      value={Math.round(value ?? 0)}
      min={min} max={max}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full border rounded px-2 py-0.5 text-xs"
    />
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`px-2 py-0.5 text-xs border rounded ${value ? 'bg-gray-800 text-white' : 'hover:bg-gray-50'}`}
    >
      {value ? 'Oui' : 'Non'}
    </button>
  )
}
