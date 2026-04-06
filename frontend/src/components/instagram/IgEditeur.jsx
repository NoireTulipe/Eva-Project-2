import { useState, useRef, useEffect } from 'react'
import { Stage, Layer, Rect, Text, Image as KImage, Transformer } from 'react-konva'
import useImage from 'use-image'
import CanvasArrow from './CanvasArrow.jsx'
import { IG_FORMATS, FORMAT_PAR_DEFAUT } from './igFormats.js'
import IgLayerPanel      from './IgLayerPanel.jsx'
import IgToolbar         from './IgToolbar.jsx'
import IgPropertiesPanel from './IgPropertiesPanel.jsx'
import IgSlideManager    from './IgSlideManager.jsx'
import IgGenerateurIA    from './IgGenerateurIA.jsx'
import IgProgrammation   from './IgProgrammation.jsx'
import { instagram }     from '../../shared/api.js'

const EXPORT_SCALE = 2  // 540px × 2 = 1080px

function newSlide() {
  return { id: Date.now(), elements: [], background: { type: 'color', value: '#ffffff' } }
}

export default function IgEditeur() {
  const stageRef = useRef(null)
  const trRef    = useRef(null)

  const [format, setFormat]         = useState(FORMAT_PAR_DEFAUT)
  const [slides, setSlides]         = useState([newSlide()])
  const [slideIdx, setSlideIdx]     = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [legende, setLegende]       = useState('')
  const [titre, setTitre]           = useState('')
  const [showIA, setShowIA]         = useState(false)
  const [showProg, setShowProg]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [postId, setPostId]         = useState(null)

  const fmt  = IG_FORMATS[format]
  const slide = slides[slideIdx]

  // ── Transformer (seulement pour text & image, pas arrow) ──────────────────
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return
    const selEl = slides[slideIdx]?.elements.find(e => e.id === selectedId)
    if (selectedId && selEl?.type !== 'arrow') {
      const node = stageRef.current.findOne(`#${selectedId}`)
      if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw() }
    } else {
      trRef.current.nodes([])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [selectedId, slides, slideIdx])

  // ── Quand le format change : réinitialiser le canvas ─────────────────────────
  function changerFormat(f) {
    if (f === format) return
    if (slide.elements.length > 0) {
      if (!window.confirm('Changer de format efface les éléments du canvas. Continuer ?')) return
    }
    setFormat(f)
    setSlides([newSlide()])
    setSlideIdx(0)
    setSelectedId(null)
  }

  // ── Helpers slide ─────────────────────────────────────────────────────────────
  function updateSlide(updater) {
    setSlides(prev => prev.map((s, i) => i === slideIdx ? updater(s) : s))
  }
  function updateElement(id, props) {
    updateSlide(s => ({ ...s, elements: s.elements.map(el => el.id === id ? { ...el, ...props } : el) }))
  }
  const selectedEl = slide.elements.find(el => el.id === selectedId) ?? null

  // ── Ajouter texte ─────────────────────────────────────────────────────────────
  function addText() {
    const id = `el-${Date.now()}`
    updateSlide(s => ({
      ...s,
      elements: [...s.elements, {
        id, type: 'text',
        x: 40, y: Math.round(fmt.displayH / 2) - 40, width: fmt.displayW - 80,
        text: 'Votre texte', fontSize: 32, fontFamily: 'Arial',
        fill: '#000000', align: 'center', fontStyle: '',
        draggable: true, opacity: 1, rotation: 0, visible: true, locked: false,
      }]
    }))
    setSelectedId(id)
  }

  // ── Ajouter une flèche courbe ─────────────────────────────────────────────────
  function addArrow() {
    const id  = `el-${Date.now()}`
    const cx  = Math.round(fmt.displayW / 2)
    const cy  = Math.round(fmt.displayH / 2)
    updateSlide(s => ({
      ...s,
      elements: [...s.elements, {
        id, type: 'arrow',
        x1: cx - 120, y1: cy + 40,
        x2: cx + 120, y2: cy + 40,
        cpx1: cx - 70, cpy1: cy - 60,  // courbure vers le haut par défaut
        cpx2: cx + 70, cpy2: cy - 60,
        stroke: '#000000', strokeWidth: 3,
        arrowHead: 'end', arrowSize: 18,
        dash: false, opacity: 1,
        visible: true, locked: false,
      }]
    }))
    setSelectedId(id)
  }

  // ── Ajouter image depuis URL ──────────────────────────────────────────────────
  function addImageFromUrl(url, nom) {
    const id = `el-${Date.now()}`
    updateSlide(s => ({
      ...s,
      elements: [...s.elements, {
        id, type: 'image', src: url, nom: nom ?? 'image',
        x: 100, y: 100, width: 200, height: 200,
        draggable: true, opacity: 1, rotation: 0,
        flipX: false, flipY: false, visible: true, locked: false,
      }]
    }))
    setSelectedId(id)
  }

  // ── Background ────────────────────────────────────────────────────────────────
  function setBackground(bg) { updateSlide(s => ({ ...s, background: bg })) }

  // ── Calques ───────────────────────────────────────────────────────────────────
  function moveLayer(id, dir) {
    updateSlide(s => {
      const els = [...s.elements]
      const idx = els.findIndex(e => e.id === id)
      const t = idx + dir
      if (t < 0 || t >= els.length) return s
      ;[els[idx], els[t]] = [els[t], els[idx]]
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
      return { ...s, elements: [...s.elements, { ...el, id: `el-${Date.now()}`, x: el.x + 20, y: el.y + 20 }] }
    })
  }

  // ── Slides ────────────────────────────────────────────────────────────────────
  function addSlide() { setSlides(prev => [...prev, newSlide()]); setSlideIdx(slides.length); setSelectedId(null) }
  function deleteSlide(idx) {
    if (slides.length === 1) return
    setSlides(prev => prev.filter((_, i) => i !== idx))
    setSlideIdx(Math.max(0, idx - 1))
    setSelectedId(null)
  }

  // ── Export PNG (toutes les vignettes) ─────────────────────────────────────────
  async function exportAllPNG() {
    if (!stageRef.current) return []
    setSelectedId(null)
    await new Promise(r => setTimeout(r, 150))
    // On ne peut exporter que la vignette courante depuis le stage
    // Pour les autres vignettes, l'export se fera à la volée lors de la publication
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: EXPORT_SCALE })
    return slides.map((s, i) => (i === slideIdx ? dataUrl : null))
  }

  function exportPNG() {
    exportAllPNG().then(urls => {
      const url = urls[slideIdx]
      if (!url) return
      const a = document.createElement('a')
      a.download = `post-instagram-${slideIdx + 1}.png`
      a.href = url
      a.click()
    })
  }

  // ── Sauvegarder en DB ─────────────────────────────────────────────────────────
  async function savePost() {
    setSaving(true)
    try {
      const data = { titre, format, vignettes: JSON.stringify(slides), legende }
      let saved
      if (postId) {
        saved = await instagram.updatePost(postId, data)
      } else {
        saved = await instagram.createPost(data)
        setPostId(saved.id)
      }
      return saved
    } finally {
      setSaving(false)
    }
  }

  // ── Publier maintenant ────────────────────────────────────────────────────────
  async function publierMaintenant() {
    setSelectedId(null)
    await new Promise(r => setTimeout(r, 150))
    const images = [stageRef.current?.toDataURL({ pixelRatio: EXPORT_SCALE })].filter(Boolean)
    const saved = await savePost()
    await instagram.publierPost(saved?.id ?? postId, images)
    alert('Post publié sur Instagram !')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-100">
      <IgToolbar
        format={format}
        onFormatChange={changerFormat}
        onAddText={addText}
        onAddArrow={addArrow}
        onAddImage={addImageFromUrl}
        onSetBackground={setBackground}
        background={slide.background}
        onExport={exportPNG}
        onSave={savePost}
        saving={saving}
        onShowIA={() => setShowIA(true)}
        onShowProg={() => setShowProg(true)}
        onPublierMaintenant={publierMaintenant}
        titre={titre}
        onTitreChange={setTitre}
      />

      <div className="flex flex-1 overflow-hidden">
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
          <p className="text-xs text-gray-400 mb-2">{fmt.label} — {fmt.exportW}×{fmt.exportH}px ({fmt.subtitle})</p>
          <div
            className="shadow-xl border border-gray-300"
            style={{ width: fmt.displayW, height: fmt.displayH }}
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
              width={fmt.displayW}
              height={fmt.displayH}
            />
          </div>
        </div>

        <IgPropertiesPanel
          element={selectedEl}
          onChange={props => selectedId && updateElement(selectedId, props)}
          onDelete={() => selectedId && deleteElement(selectedId)}
        />
      </div>

      {/* Bas : slides + légende */}
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
            placeholder="Légende d'accompagnement (avec #hashtags et @mentions)…"
            className="w-full border rounded px-3 py-1.5 text-sm resize-none"
            rows={2}
          />
        </div>
      </div>

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
                    x: 40, y: Math.round(fmt.displayH / 2) - 50, width: fmt.displayW - 80,
                    text: txt, fontSize: 28, fontFamily: 'Arial',
                    fill: '#000000', align: 'center', fontStyle: '',
                    draggable: true, opacity: 1, rotation: 0, visible: true, locked: false,
                  }]
                }
              }))
            })
            if (leg) setLegende(leg)
            setShowIA(false)
          }}
        />
      )}

      {showProg && (
        <IgProgrammation
          onClose={() => setShowProg(false)}
          onProgrammer={async (scheduledAt) => {
            setSelectedId(null)
            await new Promise(r => setTimeout(r, 150))
            const images = [stageRef.current?.toDataURL({ pixelRatio: EXPORT_SCALE })].filter(Boolean)
            const saved = await savePost()
            await instagram.programmerPost(saved?.id ?? postId, scheduledAt, images)
            setShowProg(false)
            alert(`Post programmé pour le ${new Date(scheduledAt).toLocaleString('fr-FR')}`)
          }}
        />
      )}
    </div>
  )
}

// ── Canvas Konva ──────────────────────────────────────────────────────────────

function CanvasSlide({ slide, stageRef, trRef, selectedId, onSelect, onDeselect, onUpdateElement, width, height }) {
  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={e => { if (e.target === e.target.getStage()) onDeselect() }}
    >
      <Layer>
        <SlideBackground background={slide.background} width={width} height={height} />
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
              onSelect={() => onSelect(el.id)}
              onUpdate={props => onUpdateElement(el.id, props)}
            />
          ) : el.type === 'arrow' ? (
            <CanvasArrow
              key={el.id}
              el={el}
              isSelected={selectedId === el.id}
              onSelect={() => {
                if (!el.locked) onSelect(el.id)
              }}
              onUpdate={props => onUpdateElement(el.id, props)}
            />
          ) : null
        )}
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => newBox.width < 20 || newBox.height < 20 ? oldBox : newBox}
        />
      </Layer>
    </Stage>
  )
}

function SlideBackground({ background, width, height }) {
  const src = background?.type === 'image' ? background.value : null
  const [img] = useImage(src ?? '', 'anonymous')
  if (background?.type === 'image' && img) {
    return <KImage image={img} x={0} y={0} width={width} height={height} listening={false} />
  }
  return <Rect x={0} y={0} width={width} height={height} fill={background?.value ?? '#ffffff'} listening={false} />
}

function CanvasImage({ el, onSelect, onUpdate }) {
  const [img] = useImage(el.src, 'anonymous')
  return (
    <KImage
      id={el.id}
      image={img}
      x={el.x} y={el.y}
      width={el.width} height={el.height}
      opacity={el.opacity ?? 1}
      rotation={el.rotation ?? 0}
      scaleX={el.flipX ? -1 : 1}
      scaleY={el.flipY ? -1 : 1}
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
        node.scaleX(el.flipX ? -1 : 1)
        node.scaleY(el.flipY ? -1 : 1)
      }}
    />
  )
}
