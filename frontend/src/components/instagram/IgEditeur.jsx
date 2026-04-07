import { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Rect, Text, Image as KImage, Transformer } from 'react-konva'
import useImage from 'use-image'
import CanvasArrow    from './CanvasArrow.jsx'
import CanvasShape    from './CanvasShape.jsx'
import IgLibraryPanel from './IgLibraryPanel.jsx'
import { IG_FORMATS, FORMAT_PAR_DEFAUT } from './igFormats.js'
import IgLayerPanel      from './IgLayerPanel.jsx'
import IgToolbar         from './IgToolbar.jsx'
import IgPropertiesPanel from './IgPropertiesPanel.jsx'
import IgSlideManager    from './IgSlideManager.jsx'
import IgGenerateurIA    from './IgGenerateurIA.jsx'
import IgProgrammation   from './IgProgrammation.jsx'
import IgPostsLibrary    from './IgPostsLibrary.jsx'
import { instagram }     from '../../shared/api.js'
import { useGoogleFonts } from './useGoogleFonts.js'

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
  const [showIA, setShowIA]             = useState(false)
  const [showProg, setShowProg]         = useState(false)
  const [showPosts, setShowPosts]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [postId, setPostId]             = useState(null)
  const [showLibrary, setShowLibrary]   = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dropFile, setDropFile]         = useState(null)   // fichier en attente d'import

  const fmt  = IG_FORMATS[format]
  const slide = slides[slideIdx]

  // Charger les Google Fonts dès que la liste des fonts change
  const [fonts, setFonts] = useState([])
  useEffect(() => { instagram.getFonts().then(setFonts).catch(() => {}) }, [])
  useGoogleFonts(fonts)

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

  // ── Drag & drop image sur le canvas ──────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setDropFile(file)
  }, [])

  // ── Ajouter texte ─────────────────────────────────────────────────────────────
  function addText() {
    const id  = `el-${Date.now()}`
    const idx = slides[slideIdx].elements.filter(e => e.type === 'text').length + 1
    updateSlide(s => ({
      ...s,
      elements: [...s.elements, {
        id, type: 'text',
        nom: `Texte ${idx}`,
        x: 40, y: Math.round(fmt.displayH / 2) - 40, width: fmt.displayW - 80,
        text: 'Votre texte', fontSize: 32, fontFamily: 'Arial',
        fill: '#000000', align: 'center', fontStyle: '',
        draggable: true, opacity: 1, rotation: 0, visible: true, locked: false,
      }]
    }))
    setSelectedId(id)
  }

  // ── Ajouter une forme ─────────────────────────────────────────────────────────
  function addShape(shapeType) {
    const id = `el-${Date.now()}`
    const cx = Math.round(fmt.displayW / 2)
    const cy = Math.round(fmt.displayH / 2)
    const size = shapeType === 'rect' ? { width: 200, height: 140 } : { width: 140, height: 140 }
    updateSlide(s => ({
      ...s,
      elements: [...s.elements, {
        id, type: 'shape', shapeType,
        x: cx - size.width / 2, y: cy - size.height / 2,
        width: size.width, height: size.height,
        fill: '#4f86f7', fillEnabled: true,
        stroke: '#1a3a8a', strokeWidth: 0,
        cornerRadius: 0,
        shadowEnabled: false,
        shadowColor: '#000000', shadowBlur: 10,
        shadowOffsetX: 5, shadowOffsetY: 5, shadowOpacity: 0.5,
        opacity: 1, rotation: 0,
        draggable: true, visible: true, locked: false,
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
    <div className={`flex flex-col overflow-hidden bg-gray-100 ${isFullscreen ? 'fixed inset-0 z-40' : 'h-full'}`}>
      <IgToolbar
        format={format}
        onFormatChange={changerFormat}
        onAddText={addText}
        onAddShape={addShape}
        onAddArrow={addArrow}
        onAddImage={addImageFromUrl}
        onSetBackground={setBackground}
        background={slide.background}
        onExport={exportPNG}
        onSave={savePost}
        saving={saving}
        onShowIA={() => setShowIA(true)}
        onShowProg={() => setShowProg(true)}
        onShowPosts={() => setShowPosts(true)}
        onPublierMaintenant={publierMaintenant}
        titre={titre}
        onTitreChange={setTitre}
        showLibrary={showLibrary}
        onToggleLibrary={() => setShowLibrary(v => !v)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(v => !v)}
      />

      <div className="flex flex-1 overflow-hidden">

        {/* Bibliothèque intégrée */}
        {showLibrary && (
          <IgLibraryPanel
            onAddImage={addImageFromUrl}
            onSetBackground={setBackground}
          />
        )}

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
        <div className="flex-1 flex flex-col items-center justify-center overflow-auto p-4"
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onDrop={handleDrop}
        >
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
          <p className="text-xs text-gray-300 mt-2">Glissez une image ici pour l'ajouter</p>
        </div>

        <IgPropertiesPanel
          element={selectedEl}
          onChange={props => selectedId && updateElement(selectedId, props)}
          onDelete={() => selectedId && deleteElement(selectedId)}
        />
      </div>

      {/* Bas : slides + légende */}
      <div className="border-t border-gray-200 bg-white px-4 py-2 flex-shrink-0">
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
            className="w-full border rounded px-3 py-1.5 text-sm resize-y"
            rows={3}
          />
        </div>
      </div>

      {/* Modale drag & drop */}
      {dropFile && (
        <DropImportModal
          file={dropFile}
          onCancel={() => setDropFile(null)}
          onConfirm={async ({ addToLibrary, nom }) => {
            const url = await readFileAsDataUrl(dropFile)
            if (addToLibrary) {
              const fd = new FormData()
              fd.append('fichier', dropFile)
              fd.append('nom', nom)
              await instagram.createElement(fd).catch(() => {})
            }
            addImageFromUrl(url, nom)
            setDropFile(null)
          }}
        />
      )}

      {showIA && (
        <IgGenerateurIA
          slides={slides}
          slideIdx={slideIdx}
          onClose={() => setShowIA(false)}
          onApply={({ champs, legende: leg }) => {
            // Remplir chaque élément texte par son nom
            if (champs) {
              updateSlide(s => ({
                ...s,
                elements: s.elements.map(el => {
                  if (el.type !== 'text') return el
                  const texte = champs[el.nom ?? el.id]
                  return texte ? { ...el, text: texte } : el
                })
              }))
            }
            if (leg) setLegende(leg)
            setShowIA(false)
          }}
        />
      )}

      {showPosts && (
        <IgPostsLibrary
          onClose={() => setShowPosts(false)}
          onLoad={post => {
            // Charge tout le post — remplace l'éditeur complet
            try {
              const vignettes = JSON.parse(post.vignettes)
              setSlides(vignettes)
              setSlideIdx(0)
              setSelectedId(null)
              setFormat(post.format ?? FORMAT_PAR_DEFAUT)
              setTitre(post.titre ?? '')
              setLegende(post.legende ?? '')
              setPostId(post.id)
            } catch {}
            setShowPosts(false)
          }}
          onLoadGabarit={post => {
            // Injecte uniquement le 1er slide du post comme gabarit dans la vignette courante
            try {
              const vignettes = JSON.parse(post.vignettes)
              const gabarit   = vignettes[0]
              if (!gabarit) return
              // Génère de nouveaux IDs pour éviter les collisions
              const ts = Date.now()
              const elements = (gabarit.elements ?? []).map((el, i) => ({
                ...el,
                id: `el-${ts}-${i}`,
              }))
              updateSlide(s => ({
                ...s,
                elements,
                background: gabarit.background ?? s.background,
              }))
              setSelectedId(null)
            } catch {}
            setShowPosts(false)
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Modale import drag & drop ─────────────────────────────────────────────────

function DropImportModal({ file, onCancel, onConfirm }) {
  const [nom, setNom]             = useState(file.name.replace(/\.[^.]+$/, ''))
  const [addToLibrary, setAddLib] = useState(true)
  const [preview, setPreview]     = useState(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-80 p-5 space-y-4">
        <h3 className="font-semibold text-sm">Ajouter une image</h3>
        {preview && (
          <img src={preview} alt="" className="w-full h-36 object-contain bg-gray-50 rounded border" />
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nom</label>
          <input type="text" value={nom} onChange={e => setNom(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={addToLibrary} onChange={e => setAddLib(e.target.checked)}
            className="rounded" />
          <span className="text-sm">Sauvegarder dans la bibliothèque</span>
        </label>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={() => onConfirm({ addToLibrary, nom })}
            className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600">
            Ajouter au canvas
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Effets Konva à partir des propriétés d'un élément texte ──────────────────
function buildTextEffects(el) {
  const props = {}

  // Contour
  if (el.contour?.active) {
    props.stroke = el.contour.color ?? '#000000'
    props.strokeWidth = el.contour.width ?? 2
    props.fillAfterStrokeEnabled = true
  }

  // Ombre portée (priorité : ombre simple)
  if (el.shadow?.active && !(el.effet3d?.active)) {
    props.shadowColor   = el.shadow.color ?? '#000000'
    props.shadowBlur    = el.shadow.blur ?? 8
    props.shadowOffsetX = el.shadow.offsetX ?? 4
    props.shadowOffsetY = el.shadow.offsetY ?? 4
    props.shadowOpacity = el.shadow.opacity ?? 0.6
    props.shadowEnabled = true
  }

  // Effet 3D — cascade d'ombres décalées via shadowColor + un seul offset
  // Konva ne supporte qu'une ombre, on simule avec un offset diagonal et un blur=0
  if (el.effet3d?.active) {
    const d = el.effet3d.depth ?? 5
    props.shadowColor   = el.effet3d.color ?? '#333333'
    props.shadowBlur    = 0
    props.shadowOffsetX = d
    props.shadowOffsetY = d
    props.shadowOpacity = 1
    props.shadowEnabled = true
  }

  return props
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
              {...buildTextEffects(el)}
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
          ) : el.type === 'shape' ? (
            <CanvasShape
              key={el.id}
              el={el}
              onSelect={() => { if (!el.locked) onSelect(el.id) }}
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
