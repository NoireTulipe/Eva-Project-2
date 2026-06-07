import { useState, useEffect, useRef, useCallback } from 'react'
import { montage } from '../../../shared/api.js'

const SCALE = 60
const MIN_BLOCK_W = 20
const TRACK_COLORS = { voice: '#dbeafe', music: '#d1fae5', sfx: '#fef3c7' }
const TRACK_NAMES = { voice: '🎙️ Voix', music: '🎵 Musique', sfx: '🔊 Bruitage' }
const inputCls = 'w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300'
const btnCls = 'px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-40'
const btnSmall = 'px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50'

let _vid = 0
function uid() { return 'b' + (++_vid) }

export default function Montage() {
  const [sources, setSources] = useState({ vocal: [], uploads: [] })
  const [projects, setProjects] = useState([])
  const [tracks, setTracks] = useState([
    { id: 'voice', name: 'Voix', type: 'voice', blocks: [] },
    { id: 'music', name: 'Musique', type: 'music', blocks: [] },
    { id: 'sfx', name: 'Bruitage', type: 'sfx', blocks: [] }
  ])
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [playTime, setPlayTime] = useState(0)
  const [projectName, setProjectName] = useState('Sans titre')
  const [projectId, setProjectId] = useState(null)
  const [exportUrl, setExportUrl] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  const timelineRef = useRef(null)
  const playIntervalRef = useRef(null)
  const audioCtxRef = useRef(null)
  const audioNodesRef = useRef([])
  const playbackStartRef = useRef(0)
  const previewAudioRef = useRef(null)

  const loadSources = useCallback(async () => { try { setSources(await montage.getSources()) } catch {} }, [])
  useEffect(() => { loadSources(); loadProjectList() }, [])

  async function loadProjectList() { try { setProjects(await montage.getProjects()) } catch {} }

  // ─── Gestion des blocs ─────────────────────────────────────────────────

  function addBlockToTrack(trackId, file, label, duration = 5) {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    const lastBlock = track.blocks[track.blocks.length - 1]
    const start = lastBlock ? lastBlock.start + effectiveDuration(lastBlock) : 0
    const blockId = uid()
    const block = { id: blockId, file, label: label?.slice(0, 80), start, duration, trimIn: 0, trimOut: 0, volume: 1.0 }
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, blocks: [...t.blocks, block] } : t))
    setSelectedBlock({ trackId, blockId: block.id })

    // Détecter la vraie durée depuis le fichier audio
    detectRealDuration(trackId, blockId, file)
  }

  function detectRealDuration(trackId, blockId, file) {
    const a = new Audio(file)
    a.preload = 'metadata'
    a.onloadedmetadata = () => {
      if (a.duration && isFinite(a.duration) && a.duration > 0.1) {
        updateBlock(trackId, blockId, { duration: Math.round(a.duration * 10) / 10 })
      }
    }
    a.onerror = () => {}
  }

  function updateBlock(trackId, blockId, changes) {
    setTracks(prev => prev.map(t => t.id === trackId
      ? { ...t, blocks: t.blocks.map(b => b.id === blockId ? { ...b, ...changes } : b) } : t))
  }

  function removeBlock(trackId, blockId) {
    setTracks(prev => prev.map(t => t.id === trackId
      ? { ...t, blocks: t.blocks.filter(b => b.id !== blockId) } : t))
    if (selectedBlock?.trackId === trackId && selectedBlock?.blockId === blockId) setSelectedBlock(null)
  }

  function getBlock(trackId, blockId) {
    return tracks.find(t => t.id === trackId)?.blocks.find(b => b.id === blockId)
  }

  // Durée audible d'un bloc
  function effectiveDuration(b) { return Math.max(0.1, b.duration - (b.trimIn || 0) - (b.trimOut || 0)) }

  function getTotalDuration() {
    let max = 10
    for (const t of tracks) for (const b of t.blocks) {
      const end = b.start + effectiveDuration(b)
      if (end > max) max = end
    }
    return max
  }
  const totalDuration = getTotalDuration()

  // ─── Drag blocs ───────────────────────────────────────────────────────

  function startBlockDrag(e, trackId, blockId) {
    e.preventDefault(); e.stopPropagation()
    const block = getBlock(trackId, blockId)
    if (!block) return
    const startX = e.clientX
    const origStart = block.start
    function onMove(ev) { updateBlock(trackId, blockId, { start: Math.max(0, Math.round((origStart + (ev.clientX - startX) / SCALE) * 10) / 10) }) }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ─── Preview d'un bloc ────────────────────────────────────────────────

  async function previewBlock(block) {
    if (!block?.file) return
    stopPlay()
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null }
    const a = new Audio(block.file)
    a.preload = 'auto'
    a.currentTime = block.trimIn || 0
    previewAudioRef.current = a
    setPreviewing(true)
    a.onended = () => setPreviewing(false)
    a.onerror = () => setPreviewing(false)
    try { await a.play() } catch { setPreviewing(false) }
  }

  function stopPreview() {
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null }
    setPreviewing(false)
  }

  // ─── Lecture globale (Web Audio API) ──────────────────────────────────

  function stopPlayback() {
    audioNodesRef.current.forEach(n => { try { n.stop() } catch {} })
    audioNodesRef.current = []
    if (playIntervalRef.current) { clearInterval(playIntervalRef.current); playIntervalRef.current = null }
    if (audioCtxRef.current) { try { audioCtxRef.current.close() } catch {}; audioCtxRef.current = null }
  }

  async function startPlayback(fromTime = 0) {
    stopPlayback(); stopPreview()
    setPlaying(true)
    setPlayTime(fromTime)

    const ctx = new AudioContext()
    audioCtxRef.current = ctx

    // Charger et décoder tous les blocs
    const sources = []
    for (const track of tracks) {
      for (const block of track.blocks) {
        if (!block.file) continue
        const eff = effectiveDuration(block)
        if (eff <= 0.1) continue
        try {
          const resp = await fetch(block.file)
          const buffer = await resp.arrayBuffer()
          const audioBuffer = await ctx.decodeAudioData(buffer)
          sources.push({ buffer: audioBuffer, block, eff })
        } catch {}
      }
    }

    const now = ctx.currentTime + 0.1 // léger délai pour laisser le temps de setup
    const nodes = []

    for (const { buffer, block, eff } of sources) {
      const blockEnd = block.start + eff
      // Ne pas jouer les blocs qui sont avant le fromTime
      if (blockEnd <= fromTime) continue

      const trimIn = block.trimIn || 0
      // Calculer l'offset dans l'audio et le délai
      let offset = trimIn
      let delay = block.start - fromTime

      if (block.start < fromTime) {
        // Le bloc a déjà commencé — on rattrape
        offset = trimIn + (fromTime - block.start)
        delay = 0
      }

      if (offset >= block.duration - (block.trimOut || 0)) continue

      const remaining = block.duration - offset - (block.trimOut || 0)
      if (remaining <= 0.1) continue

      const node = ctx.createBufferSource()
      node.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.value = block.volume ?? 1.0
      node.connect(gain).connect(ctx.destination)
      node.start(now + Math.max(0, delay), offset, remaining)
      nodes.push(node)
    }

    audioNodesRef.current = nodes

    if (nodes.length === 0) { ctx.close(); setPlaying(false); return }

    const startWall = now - fromTime
    playIntervalRef.current = setInterval(() => {
      const elapsed = ctx.currentTime - startWall
      setPlayTime(elapsed)
      if (elapsed >= totalDuration + 1) { stopAll() }
    }, 80)

    function stopAll() {
      nodes.forEach(n => { try { n.stop() } catch {} })
      clearInterval(playIntervalRef.current)
      ctx.close()
      setPlaying(false)
    }
    audioStopRef.current = stopAll
  }

  const audioStopRef = useRef(null)

  function stopPlay() {
    stopPlayback()
    if (audioStopRef.current) { audioStopRef.current(); audioStopRef.current = null }
    setPlaying(false); setPlayTime(0)
  }

  function togglePlay() {
    if (playing) { stopPlay(); return }
    startPlayback(0)
  }

  // ─── Seek : clic sur la timeline ─────────────────────────────────────

  function handleTimelineClick(e) {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    const scrollLeft = timelineRef.current?.scrollLeft || 0
    const x = e.clientX - rect.left + scrollLeft
    const time = Math.max(0, x / SCALE)
    if (playing) {
      // Rejouer depuis cette position
      startPlayback(time)
    } else {
      setPlayTime(time)
    }
  }

  useEffect(() => { return () => stopPlay() }, [])

  // ─── Export ───────────────────────────────────────────────────────────

  async function handleExport() {
    try {
      const result = await montage.exportMontage({ tracks })
      setExportUrl(result.url)
    } catch (e) { alert('Erreur export : ' + e.message) }
  }

  // ─── Projets ──────────────────────────────────────────────────────────

  async function handleSave() {
    const id = projectId || Date.now().toString(36)
    setProjectId(id)
    await montage.saveProject(id, { name: projectName, tracks })
    loadProjectList()
  }

  async function handleLoad(id) {
    try {
      const p = await montage.getProject(id)
      setTracks(p.tracks || [])
      setProjectName(p.name || 'Sans titre')
      setProjectId(p.id)
      stopPlay()
    } catch {}
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await montage.uploadFile(file)
      setSources(prev => ({ ...prev, uploads: [...prev.uploads, { name: result.name, file: result.file, label: result.name }] }))
      addBlockToTrack('music', result.file, result.name, Math.min(file.size / 16000, 30))
    } catch { alert('Erreur upload') }
  }

  // ─── Sélection ────────────────────────────────────────────────────────

  const selBlock = selectedBlock ? getBlock(selectedBlock.trackId, selectedBlock.blockId) : null
  const timelineWidth = Math.max(totalDuration * SCALE + 200, 800)

  // ─── Rendu ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-full mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">🎬 Montage audio</h1>
        <div className="flex gap-2 items-center">
          <input className={inputCls + ' w-40'} value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Nom du projet" />
          <button className={btnCls} onClick={handleSave} title="Sauvegarder">💾</button>
          <select className={inputCls + ' w-36'} onChange={e => e.target.value && handleLoad(e.target.value)} value="">
            <option value="">📂 Charger…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3" style={{ height: 'calc(100vh - 160px)' }}>
        {/* ── Sources ───────────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 overflow-y-auto space-y-2 bg-white rounded-lg border border-gray-200 p-3">
          <h2 className="text-xs font-semibold text-gray-700 mb-2">📦 Sources</h2>

          <details className="text-xs" open>
            <summary className="font-medium text-gray-600 cursor-pointer">🎙️ Sessions vocales</summary>
            <div className="mt-1 space-y-1 max-h-56 overflow-y-auto">
              {sources.vocal.map(s => (
                <details key={s.sessionId} className="text-xs ml-1">
                  <summary className="text-gray-500 cursor-pointer truncate hover:text-gray-700">
                    {new Date(s.createdAt).toLocaleDateString()} — {s.chunks.length} seg. ({s.provider})
                  </summary>
                  <div className="ml-1 space-y-0.5">
                    {s.chunks.map((c, i) => (
                      <button key={i} className="block w-full text-left text-gray-600 hover:bg-blue-50 rounded px-1 py-0.5 text-[11px] truncate"
                        onClick={() => addBlockToTrack('voice', c.file, c.text || `Seg. ${i + 1}`, c.duration || 5)}
                        title={c.text}>🎵 {c.text?.slice(0, 45) || `Seg. ${i + 1}`}</button>
                    ))}
                  </div>
                </details>
              ))}
              {sources.vocal.length === 0 && <p className="text-gray-400 italic">Aucune session vocale</p>}
            </div>
          </details>

          <details className="text-xs" open>
            <summary className="font-medium text-gray-600 cursor-pointer">📁 Uploads</summary>
            <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
              {sources.uploads.map((u, i) => (
                <button key={i} className="block w-full text-left text-gray-600 hover:bg-green-50 rounded px-1 py-0.5 text-[11px] truncate"
                  onClick={() => addBlockToTrack('music', u.file, u.label, 10)}>🎧 {u.label}</button>
              ))}
              {sources.uploads.length === 0 && <p className="text-gray-400 italic">Aucun upload</p>}
            </div>
          </details>

          <label className="block text-center py-2 border-2 border-dashed border-gray-300 rounded text-xs text-gray-400 hover:border-indigo-400 cursor-pointer">
            + Importer un fichier
            <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>

        {/* ── Timeline ───────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-auto relative"
          ref={timelineRef}
          onClick={handleTimelineClick}
          style={{ cursor: playing ? 'pointer' : 'default' }}
        >
          {/* Règle cliquable */}
          <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 h-6 flex items-end cursor-pointer" style={{ width: timelineWidth }}>
            {Array.from({ length: Math.ceil(totalDuration) + 2 }, (_, i) => (
              <div key={i} className="absolute text-[10px] text-gray-400" style={{ left: i * SCALE, bottom: 2 }}>{i}s</div>
            ))}
          </div>

          {/* Curseur de lecture */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-lg" style={{ left: playTime * SCALE }}>
            <div className="w-3 h-3 bg-red-500 rounded-full -ml-1 -mt-0.5" />
          </div>

          <div style={{ width: timelineWidth, paddingBottom: 40 }}>
            {tracks.map(track => (
              <div key={track.id} className="border-b border-gray-100 relative"
                style={{ minHeight: 60, backgroundColor: track.type === 'voice' ? '#fafbfc' : track.type === 'music' ? '#f8fdf9' : '#fffdf7' }}>
                <div className="sticky left-0 w-20 text-[11px] text-gray-500 py-1 px-2 bg-white/90 font-medium">{TRACK_NAMES[track.type]}</div>
                {track.blocks.map(block => {
                  const isSel = selectedBlock?.trackId === track.id && selectedBlock?.blockId === block.id
                  const eff = effectiveDuration(block)
                  const w = Math.max(MIN_BLOCK_W, eff * SCALE)
                  return (
                    <div key={block.id}
                      className={`absolute top-2 h-14 rounded border-2 cursor-pointer group ${isSel ? 'border-indigo-500 ring-2 ring-indigo-200 z-10' : 'border-gray-300 hover:border-gray-400'}`}
                      style={{ left: block.start * SCALE, width: w, backgroundColor: TRACK_COLORS[track.type] }}
                      onClick={e => { e.stopPropagation(); setSelectedBlock({ trackId: track.id, blockId: block.id }) }}
                      onDoubleClick={e => { e.stopPropagation(); previewBlock(block) }}
                      onMouseDown={e => startBlockDrag(e, track.id, block.id)}>
                      <div className="absolute top-0 h-full w-full flex items-center px-1 overflow-hidden rounded">
                        <span className="text-[10px] text-gray-700 truncate">{block.label} <span className="text-gray-400">({eff.toFixed(1)}s)</span></span>
                      </div>
                      <button className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center"
                        onClick={e => { e.stopPropagation(); removeBlock(track.id, block.id) }}>✕</button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Propriétés ─────────────────────────────────────────────── */}
        <div className="w-48 flex-shrink-0 bg-white rounded-lg border border-gray-200 p-3 overflow-y-auto text-xs space-y-3">
          <h2 className="font-semibold text-gray-700">✏️ Bloc</h2>
          {selBlock ? (
            <>
              <p className="text-gray-600 truncate text-[11px]" title={selBlock.label}>{selBlock.label}</p>
              <div className="flex gap-1">
                <button className={btnSmall + ' flex-1 ' + (previewing ? '!bg-green-100 !border-green-400' : '')}
                  onClick={() => previewBlock(selBlock)}>
                  {previewing ? '⏹️ Stop' : '▶️ Écouter'}
                </button>
              </div>
              <div>
                <label className="text-gray-500">Position (s)</label>
                <input type="number" className={inputCls} step={0.1} min={0} value={selBlock.start}
                  onChange={e => updateBlock(selectedBlock.trackId, selectedBlock.blockId, { start: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-gray-500">Trim début ({selBlock.trimIn || 0}s)</label>
                <input type="range" className="w-full" min={0} max={selBlock.duration - (selBlock.trimOut || 0) - 0.3} step={0.1} value={selBlock.trimIn || 0}
                  onChange={e => updateBlock(selectedBlock.trackId, selectedBlock.blockId, { trimIn: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-gray-500">Trim fin ({selBlock.trimOut || 0}s)</label>
                <input type="range" className="w-full" min={0} max={selBlock.duration - (selBlock.trimIn || 0) - 0.3} step={0.1} value={selBlock.trimOut || 0}
                  onChange={e => updateBlock(selectedBlock.trackId, selectedBlock.blockId, { trimOut: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-gray-500">Volume ({Math.round((selBlock.volume ?? 1) * 100)}%)</label>
                <input type="range" className="w-full" min={0} max={1.5} step={0.05} value={selBlock.volume ?? 1}
                  onChange={e => updateBlock(selectedBlock.trackId, selectedBlock.blockId, { volume: parseFloat(e.target.value) })} />
              </div>
              <p className="text-gray-500">Durée audible: <b>{effectiveDuration(selBlock).toFixed(1)}s</b> (original: {selBlock.duration.toFixed(1)}s)</p>
              <button className={btnSmall + ' w-full'} onClick={() => detectRealDuration(selectedBlock.trackId, selectedBlock.blockId, selBlock.file)}>🔄 Re-détecter durée réelle</button>
              <button className={btnSmall + ' w-full !text-red-600 !border-red-300 hover:!bg-red-50'}
                onClick={() => removeBlock(selectedBlock.trackId, selectedBlock.blockId)}>🗑️ Supprimer ce bloc</button>
            </>
          ) : (
            <div className="text-gray-400 text-[11px] space-y-1">
              <p>Sélectionnez un bloc</p>
              <p>💡 Double-clic = écouter</p>
              <p>✕ au survol = supprimer</p>
              <p>🖱️ Clic timeline = seek</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Contrôles ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-2">
        <button className={btnCls + ' text-base px-4'} onClick={togglePlay}>
          {playing ? '⏹️ Stop' : '▶️ Lecture'}
        </button>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{playTime.toFixed(1)}s</span>
          <span>/</span>
          <span>{totalDuration.toFixed(1)}s</span>
        </div>
        <input type="range" className="w-32" min={0} max={totalDuration} step={0.05} value={playTime}
          onChange={e => {
            const t = parseFloat(e.target.value)
            setPlayTime(t)
            if (playing) startPlayback(t)
          }} />
        <button className={btnCls + ' !bg-green-600 hover:!bg-green-700'} onClick={handleExport}>📥 Exporter MP3</button>
        {exportUrl && <a href={exportUrl} className="text-xs text-green-600 font-medium" download>Télécharger</a>}
        <div className="flex-1" />
        <span className="text-xs text-gray-400">{tracks.reduce((s, t) => s + t.blocks.length, 0)} blocs</span>
      </div>
    </div>
  )
}
