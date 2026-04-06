import { useState, useRef, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect, Text, Image as KImage, Transformer } from 'react-konva'
import useImage from 'use-image'
import IgLayerPanel     from './IgLayerPanel.jsx'
import IgToolbar        from './IgToolbar.jsx'
import IgPropertiesPanel from './IgPropertiesPanel.jsx'
import IgSlideManager   from './IgSlideManager.jsx'
import IgGenerateurIA   from './IgGenerateurIA.jsx'
import { instagram }    from '../../shared/api.js'

// Format carré Instagram : 1080×1080 → affiché à 540×540
const CANVAS_W = 540
const CANVAS_H = 540
const EXPORT_SCALE = 2  // export à 1080×1080

function newSlide() {
  return { id: Date.now(), elements: [], background: { type: 'color', value: '#ffffff' } }
}

export default function IgEditeur() {
  const stageRef = useRef(null)
  const trRef    = useRef(null)

  const [slides, setSlides]         = useState([newSlide()])
  const [slideIdx, setSlideIdx]     = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [legende, setLegende]       = useState('')
  const [showIA, setShowIA]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [titre, setTitre]           = useState('')

  const slide = slides[slideIdx]

  // ── Attacher le Transformer à l'élément sélectionné ─────────────────────────
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return
    if (selectedId) {
      const node = stageRef.current.findOne(`#${selectedId}`)
      if (node) {
        trRef.current.nodes([node])
        trRef.current.getLayer().batchDraw()
      }
    } else {
      trRef.current.nodes([])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [selectedId, slide.elements])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function updateSlide(updater) {
    setSlides(prev => prev.map((s, i) => i === slideIdx ? updater(s) : s))
  }

  function updateElement(id, props) {
    updateSlide(s => ({
      ...s,
      elements: s.elements.map(el => el.id === id ? { ...el, ...props } : el)
    }))
  }

  const selectedEl = slide.elements.find(el => el.id === selectedId) ?? null

  // ── Ajouter un texte ─────────────────────────────────────────────────────────

  function addText() {
    const id = `el-${Date.now()}`
    updateSlide(s => ({
      ...s,
      elements: [...s.elements, {
        id, type: 'text',
        x: 60, y: 60, width: 420,
        text: 'Votre texte',
        fontSize: 32, fontFamily: 'Arial',
        fill: '#000000', align: 'center',
        fontStyle: '', draggable: true,
        opacity: 1, rotation: 0, visible: true, locked: false,
      }]
    }))
    setSelectedId(id)
  }

  // ── Ajouter une image depuis URL ─────────────────────────────────────────────

  function addImageFromUrl(url, nom) {
    const id = `el-${Date.now()}`
    updateSlide(s => ({
      ...s,
      elements: [...s.elements, {
        id, type: 'image',
        src: url, nom: nom ?? 'image',
        x: 100, y: 100, width: 200, height: 200,
        draggable: true, opacity: 1, rotation: 0,
        flipX: false, flipY: false,
        visible: true, locked: false,
      }]
    }))
    setSelectedId(id)
  }

  // ── Définir le background ────────────────────────────────────────────────────

  function setBackground(bg) {
    updateSlide(s => ({ ...s, background: bg }))
  }

  // ── Gestion des calques ──────────────────────────────────────────────────────

  function moveLayer(id, dir) {
    updateSlide(s => {
      const els = [...s.elements]
      const idx = els.findIndex(e => e.id === id)
      const target = idx + dir
      if (target < 0 || target >= els.length) return s
      ;[els[idx], els[target]] = [els[target], els[idx]]
      return { ...s, elements: els }
    })
  }

  function deleteElement(id) {
    updateSlide(s => ({ ...s, elements: s.elements.filter(e => e.id !== id) }))
    setSelectedId(null)
  }

  function duplicateElement(id) {
    updateSlide(s => {
      const el = s.elements.find(e => e.id === id)
      if (!el) return s
      const copy = { ...el, id: `el-${Date.now()}`, x: el.x + 20, y: el.y + 20 }
      return { ...s, elements: [...s.elements, copy] }
    })
  }

  // ── Slides ───────────────────────────────────────────────────────────────────

  function addSlide() {
    setSlides(prev => [...prev, newSlide()])
    setSlideIdx(slides.length)
    setSelectedId(null)
  }

  function deleteSlide(idx) {
    if (slides.length === 1) return
    setSlides(prev => prev.filter((_, i) => i !== idx))
    setSlideIdx(Math.max(0, idx - 1))
    setSelectedId(null)
  }

  // ── Export PNG ───────────────────────────────────────────────────────────────

  function exportPNG() {
    if (!stageRef.current) return
    setSelectedId(null)
    setTimeout(() => {
      const uri = stageRef.current.toDataURL({ pixelRatio: EXPORT_SCALE })
      const a = document.createElement('a')
      a.download = `post-instagram-${slideIdx + 1}.png`
      a.href = uri
      a.click()
    }, 100)
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────────

  async function savePost() {
    setSaving(true)
    try {
      await instagram.createPost({
        titre,
        vignettes: JSON.stringify(slides),
        legende,
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Rendu canvas d'un slide ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-100">

      {/* Toolbar */}
      <IgToolbar
        onAddText={addText}
        onAddImage={addImageFromUrl}
        onSetBackground={setBackground}
        background={slide.background}
        onExport={exportPNG}
        onSave={savePost}
        saving={saving}
        onShowIA={() => setShowIA(true)}
        titre={titre}
        onTitreChange={setTitre}
      />

      <div className="flex flex-1 overflow-hidden">

        {/* Panneau calques */}
        <IgLayerPanel
          elements={slide.elements}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMoveUp={id => moveLayer(id, -1)}
          onMoveDown={id => moveLayer(id, 1)}
          onDelete={deleteElement}
          onDuplicate={duplicateElement}
          onToggleVisible={id => updateElement(id, { visible: !slide.elements.find(e => e.id === id)?.visible })}
          onToggleLock={id => updateElement(id, { locked: !slide.elements.find(e => e.id === id)?.locked })}
        />

        {/* Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-auto p-4">
          <div
            className="shadow-xl border border-gray-300"
            style={{ width: CANVAS_W, height: CANVAS_H }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedId(null) }}
          >
            <CanvasSlide
              slide={slide}
              stageRef={stageRef}
              trRef={trRef}
              selectedId={selectedId}
              onSelect={id => {
                const el = slide.elements.find(e => e.id === id)
                if (el?.locked) return
                setSelectedId(id)
              }}
              onDeselect={() => setSelectedId(null)}
              onUpdateElement={updateElement}
              width={CANVAS_W}
              height={CANVAS_H}
            />
          </div>
        </div>

        {/* Panneau propriétés */}
        <IgPropertiesPanel
          element={selectedEl}
          onChange={props => selectedId && updateElement(selectedId, props)}
          onDelete={() => selectedId && deleteElement(selectedId)}
        />
      </div>

      {/* Gestion slides + légende */}
      <div className="border-t border-gray-200 bg-white px-4 py-2">
        <IgSlideManager
          slides={slides}
          currentIdx={slideIdx}
          onSelect={i => { setSlideIdx(i); setSelectedId(null) }}
          onAdd={addSlide}
          onDelete={deleteSlide}
        />
        <div className="mt-2">
          <textarea
            value={legende}
            onChange={e => setLegende(e.target.value)}
            placeholder="Légende d'accompagnement…"
            className="w-full border rounded px-3 py-1.5 text-sm resize-none"
            rows={2}
          />
        </div>
      </div>

      {/* Modale générateur IA */}
      {showIA && (
        <IgGenerateurIA
          nbSlides={slides.length}
          onClose={() => setShowIA(false)}
          onApply={({ textes, legende: leg }) => {
            textes.forEach((txt, i) => {
              if (!slides[i]) return
              setSlides(prev => prev.map((s, si) => {
                if (si !== i) return s
                const id = `el-${Date.now()}-${i}`
                return {
                  ...s,
                  elements: [...s.elements, {
                    id, type: 'text',
                    x: 40, y: 200, width: 460,
                    text: txt, fontSize: 28, fontFamily: 'Arial',
                    fill: '#000000', align: 'center',
                    fontStyle: '', draggable: true,
                    opacity: 1, rotation: 0, visible: true, locked: false,
                  }]
                }
              }))
            })
            if (leg) setLegende(leg)
            setShowIA(false)
          }}
        />
      )}
    </div>
  )
}

// ── Rendu Konva d'un slide ────────────────────────────────────────────────────

function CanvasSlide({ slide, stageRef, trRef, selectedId, onSelect, onDeselect, onUpdateElement, width, height }) {
  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={e => { if (e.target === e.target.getStage()) onDeselect() }}
    >
      <Layer>
        {/* Background */}
        <SlideBackground background={slide.background} width={width} height={height} />

        {/* Éléments */}
        {slide.elements.filter(el => el.visible !== false).map(el =>
          el.type === 'text' ? (
            <Text
              key={el.id}
              id={el.id}
              x={el.x} y={el.y}
              width={el.width}
              text={el.text}
              fontSize={el.fontSize}
              fontFamily={el.fontFamily}
              fill={el.fill}
              align={el.align}
              fontStyle={el.fontStyle}
              opacity={el.opacity ?? 1}
              rotation={el.rotation ?? 0}
              draggable={!el.locked}
              onClick={() => onSelect(el.id)}
              onTap={() => onSelect(el.id)}
              onDragEnd={e => onUpdateElement(el.id, { x: e.target.x(), y: e.target.y() })}
              onTransformEnd={e => {
                const node = e.target
                onUpdateElement(el.id, {
                  x: node.x(), y: node.y(),
                  width: Math.max(5, node.width() * node.scaleX()),
                  rotation: node.rotation(),
                })
                node.scaleX(1); node.scaleY(1)
              }}
            />
          ) : el.type === 'image' ? (
            <CanvasImage
              key={el.id}
              el={el}
              selected={selectedId === el.id}
              onSelect={() => onSelect(el.id)}
              onUpdate={props => onUpdateElement(el.id, props)}
            />
          ) : null
        )}

        {/* Transformer */}
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
        />
      </Layer>
    </Stage>
  )
}

// ── Background ────────────────────────────────────────────────────────────────

function SlideBackground({ background, width, height }) {
  const src = background?.type === 'image' ? background.value : null
  const [img] = useImage(src ?? '', 'anonymous')

  if (background?.type === 'image' && img) {
    return (
      <KImage
        image={img}
        x={0} y={0}
        width={width} height={height}
        listening={false}
      />
    )
  }
  return (
    <Rect
      x={0} y={0}
      width={width} height={height}
      fill={background?.value ?? '#ffffff'}
      listening={false}
    />
  )
}

// ── Image element ─────────────────────────────────────────────────────────────

function CanvasImage({ el, onSelect, onUpdate }) {
  const [img] = useImage(el.src, 'anonymous')
  const scaleX = el.flipX ? -1 : 1
  const scaleY = el.flipY ? -1 : 1

  return (
    <KImage
      id={el.id}
      image={img}
      x={el.x} y={el.y}
      width={el.width} height={el.height}
      opacity={el.opacity ?? 1}
      rotation={el.rotation ?? 0}
      scaleX={scaleX} scaleY={scaleY}
      offsetX={el.flipX ? el.width : 0}
      offsetY={el.flipY ? el.height : 0}
      draggable={!el.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={e => onUpdate({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={e => {
        const node = e.target
        onUpdate({
          x: node.x(), y: node.y(),
          width: Math.abs(node.width() * node.scaleX()),
          height: Math.abs(node.height() * node.scaleY()),
          rotation: node.rotation(),
        })
        node.scaleX(scaleX); node.scaleY(scaleY)
      }}
    />
  )
}
