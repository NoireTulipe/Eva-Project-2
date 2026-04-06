/**
 * CanvasArrow — Flèche courbe Bézier cubique dans Konva
 *
 * Données de l'élément :
 *   x1, y1    : point de départ
 *   x2, y2    : point d'arrivée
 *   cpx1, cpy1 : 1er point de contrôle (near start)
 *   cpx2, cpy2 : 2ème point de contrôle (near end)
 *   stroke     : couleur (#hex)
 *   strokeWidth : épaisseur (px)
 *   arrowHead  : 'end' | 'start' | 'both' | 'none'
 *   arrowSize  : taille de la pointe (px)
 *   dash       : false | true
 *   opacity    : 0–1
 */

import { Shape, Circle, Line, Group } from 'react-konva'

// Calcule la pointe de flèche (triangle fermé) à partir d'un angle
function arrowHeadPoints(ax, ay, bx, by, size) {
  const angle = Math.atan2(ay - by, ax - bx)
  const spread = Math.PI / 7  // ouverture de la pointe
  return [
    bx + size * Math.cos(angle - spread),
    by + size * Math.sin(angle - spread),
    bx,
    by,
    bx + size * Math.cos(angle + spread),
    by + size * Math.sin(angle + spread),
  ]
}

export default function CanvasArrow({ el, isSelected, onSelect, onUpdate }) {
  const { x1, y1, x2, y2, cpx1, cpy1, cpx2, cpy2 } = el
  const stroke      = el.stroke ?? '#000000'
  const strokeWidth = el.strokeWidth ?? 3
  const arrowSize   = el.arrowSize ?? 18
  const arrowHead   = el.arrowHead ?? 'end'
  const dashArr     = el.dash ? [12, 8] : []
  const opacity     = el.opacity ?? 1

  // Fonction de dessin de la courbe principale
  const bezierFunc = (ctx, shape) => {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2)
    ctx.strokeShape(shape)
  }

  // Pointes aux extrémités
  const headEnd   = arrowHeadPoints(cpx2, cpy2, x2, y2, arrowSize)
  const headStart = arrowHeadPoints(cpx1, cpy1, x1, y1, arrowSize)

  const HANDLE_R   = 7
  const CTRL_R     = 5
  const HANDLE_COL = '#e879f9'   // pink-400
  const CTRL_COL   = '#818cf8'   // indigo-400
  const GUIDE_COL  = '#818cf8'

  return (
    <Group opacity={opacity} onClick={onSelect} onTap={onSelect}>
      {/* Courbe Bézier */}
      <Shape
        sceneFunc={bezierFunc}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dashArr}
        lineCap="round"
        hitStrokeWidth={16}
      />

      {/* Pointe fin */}
      {(arrowHead === 'end' || arrowHead === 'both') && (
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath()
            ctx.moveTo(headEnd[0], headEnd[1])
            ctx.lineTo(headEnd[2], headEnd[3])
            ctx.lineTo(headEnd[4], headEnd[5])
            ctx.closePath()
            ctx.fillShape(shape)
          }}
          fill={stroke}
          opacity={opacity}
        />
      )}

      {/* Pointe début */}
      {(arrowHead === 'start' || arrowHead === 'both') && (
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath()
            ctx.moveTo(headStart[0], headStart[1])
            ctx.lineTo(headStart[2], headStart[3])
            ctx.lineTo(headStart[4], headStart[5])
            ctx.closePath()
            ctx.fillShape(shape)
          }}
          fill={stroke}
          opacity={opacity}
        />
      )}

      {/* ── Handles d'édition (visibles seulement quand sélectionné) ── */}
      {isSelected && !el.locked && (
        <>
          {/* Lignes guide cp→point */}
          <Line points={[x1, y1, cpx1, cpy1]} stroke={GUIDE_COL} strokeWidth={1} dash={[4, 4]} listening={false} />
          <Line points={[x2, y2, cpx2, cpy2]} stroke={GUIDE_COL} strokeWidth={1} dash={[4, 4]} listening={false} />

          {/* Point de départ */}
          <Circle
            x={x1} y={y1}
            radius={HANDLE_R}
            fill="white" stroke={HANDLE_COL} strokeWidth={2}
            draggable
            onDragMove={e => onUpdate({ x1: e.target.x(), y1: e.target.y() })}
            onDragEnd={e  => onUpdate({ x1: e.target.x(), y1: e.target.y() })}
          />
          {/* Point d'arrivée */}
          <Circle
            x={x2} y={y2}
            radius={HANDLE_R}
            fill="white" stroke={HANDLE_COL} strokeWidth={2}
            draggable
            onDragMove={e => onUpdate({ x2: e.target.x(), y2: e.target.y() })}
            onDragEnd={e  => onUpdate({ x2: e.target.x(), y2: e.target.y() })}
          />
          {/* Contrôle 1 */}
          <Circle
            x={cpx1} y={cpy1}
            radius={CTRL_R}
            fill={CTRL_COL} stroke="white" strokeWidth={1.5}
            draggable
            onDragMove={e => onUpdate({ cpx1: e.target.x(), cpy1: e.target.y() })}
            onDragEnd={e  => onUpdate({ cpx1: e.target.x(), cpy1: e.target.y() })}
          />
          {/* Contrôle 2 */}
          <Circle
            x={cpx2} y={cpy2}
            radius={CTRL_R}
            fill={CTRL_COL} stroke="white" strokeWidth={1.5}
            draggable
            onDragMove={e => onUpdate({ cpx2: e.target.x(), cpy2: e.target.y() })}
            onDragEnd={e  => onUpdate({ cpx2: e.target.x(), cpy2: e.target.y() })}
          />
        </>
      )}
    </Group>
  )
}
