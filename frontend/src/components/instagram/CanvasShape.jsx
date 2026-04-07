/**
 * CanvasShape — Rendu Konva des formes géométriques (rect, cercle, triangle, pentagone, étoile)
 * Stockage : x/y = coin supérieur gauche de la bounding box, width/height = dimensions
 */
import { Rect, Ellipse, RegularPolygon, Star } from 'react-konva'

function buildShadow(el) {
  if (!el.shadowEnabled) return { shadowEnabled: false }
  return {
    shadowEnabled: true,
    shadowColor:   el.shadowColor   ?? '#000000',
    shadowBlur:    el.shadowBlur    ?? 10,
    shadowOffsetX: el.shadowOffsetX ?? 5,
    shadowOffsetY: el.shadowOffsetY ?? 5,
    shadowOpacity: el.shadowOpacity ?? 0.5,
  }
}

export default function CanvasShape({ el, onSelect, onUpdate }) {
  const w = el.width  ?? 150
  const h = el.height ?? 150
  const r = Math.round(Math.min(w, h) / 2)

  const common = {
    id: el.id,
    opacity: el.opacity ?? 1,
    rotation: el.rotation ?? 0,
    draggable: !el.locked,
    onClick: onSelect,
    onTap: onSelect,
    fill: el.fillEnabled !== false ? (el.fill ?? '#4f86f7') : 'rgba(0,0,0,0)',
    stroke: el.stroke ?? '#000000',
    strokeWidth: el.strokeWidth ?? 0,
    strokeEnabled: (el.strokeWidth ?? 0) > 0,
    ...buildShadow(el),
  }

  if (el.shapeType === 'rect') {
    return (
      <Rect
        {...common}
        x={el.x} y={el.y}
        width={w} height={h}
        cornerRadius={el.cornerRadius ?? 0}
        onDragEnd={e => onUpdate({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={e => {
          const node = e.target
          onUpdate({
            x: node.x(), y: node.y(),
            width:    Math.max(10, w * node.scaleX()),
            height:   Math.max(10, h * node.scaleY()),
            rotation: node.rotation(),
          })
          node.scaleX(1); node.scaleY(1)
        }}
      />
    )
  }

  if (el.shapeType === 'circle') {
    return (
      <Ellipse
        {...common}
        x={el.x + w / 2} y={el.y + h / 2}
        radiusX={w / 2} radiusY={h / 2}
        onDragEnd={e => onUpdate({ x: e.target.x() - w / 2, y: e.target.y() - h / 2 })}
        onTransformEnd={e => {
          const node = e.target
          const nw = Math.max(10, w * node.scaleX())
          const nh = Math.max(10, h * node.scaleY())
          onUpdate({
            x: node.x() - nw / 2, y: node.y() - nh / 2,
            width: nw, height: nh,
            rotation: node.rotation(),
          })
          node.scaleX(1); node.scaleY(1)
        }}
      />
    )
  }

  if (el.shapeType === 'triangle') {
    return (
      <RegularPolygon
        {...common}
        x={el.x + r} y={el.y + r}
        sides={3} radius={r}
        onDragEnd={e => onUpdate({ x: e.target.x() - r, y: e.target.y() - r })}
        onTransformEnd={e => {
          const node = e.target
          const nr = Math.max(10, r * Math.max(node.scaleX(), node.scaleY()))
          onUpdate({ x: node.x() - nr, y: node.y() - nr, width: nr * 2, height: nr * 2, rotation: node.rotation() })
          node.scaleX(1); node.scaleY(1)
        }}
      />
    )
  }

  if (el.shapeType === 'pentagon') {
    return (
      <RegularPolygon
        {...common}
        x={el.x + r} y={el.y + r}
        sides={5} radius={r}
        onDragEnd={e => onUpdate({ x: e.target.x() - r, y: e.target.y() - r })}
        onTransformEnd={e => {
          const node = e.target
          const nr = Math.max(10, r * Math.max(node.scaleX(), node.scaleY()))
          onUpdate({ x: node.x() - nr, y: node.y() - nr, width: nr * 2, height: nr * 2, rotation: node.rotation() })
          node.scaleX(1); node.scaleY(1)
        }}
      />
    )
  }

  if (el.shapeType === 'star') {
    return (
      <Star
        {...common}
        x={el.x + r} y={el.y + r}
        numPoints={5}
        outerRadius={r}
        innerRadius={Math.round(r * 0.45)}
        onDragEnd={e => onUpdate({ x: e.target.x() - r, y: e.target.y() - r })}
        onTransformEnd={e => {
          const node = e.target
          const nr = Math.max(10, r * Math.max(node.scaleX(), node.scaleY()))
          onUpdate({ x: node.x() - nr, y: node.y() - nr, width: nr * 2, height: nr * 2, rotation: node.rotation() })
          node.scaleX(1); node.scaleY(1)
        }}
      />
    )
  }

  return null
}
