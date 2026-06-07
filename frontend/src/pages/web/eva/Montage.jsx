import { useState, useEffect, useRef, useCallback } from 'react'
import { montage, vocal } from '../../../shared/api.js'

const SCALE = 60 // px par seconde
const MIN_BLOCK_W = 20 // px minimum

const TRACK_COLORS = { voice: '#dbeafe', music: '#d1fae5', sfx: '#fef3c7' }
const TRACK_NAMES = { voice: '🎙️ Voix', music: '🎵 Musique', sfx: '🔊 Bruitage' }
const VOICE_COLORS = ['#fef3c7','#dbeafe','#d1fae5','#ede9fe','#fce7f3','#e0f2fe','#fef2f2','#f0fdf4','#faf5ff','#fff7ed','#ffedd5','#ecfdf5','#eff6ff','#fdf2f8']

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
  const [selectedBlock, setSelectedBlock] = useState(null) // { trackId, blockId }
  const [playing, setPlaying] = useState(false)
  const [playTime, setPlayTime] = useState(0)
  const [projectName, setProjectName] = useState('Sans titre')
  const [projectId, setProjectId] = useState(null)
  const [exportUrl, setExportUrl] = useState(null)

  const timelineRef = useRef(null)
  const playIntervalRef = useRef(null)
  const audioContextRef = useRef(null)
  const playStartTimeRef = useRef(0)

  // Charger les sources
  const loadSources = useCallback(async () => {
    try { setSources(await montage.getSources()) } catch {}
  }, [])

  useEffect(() => { loadSources(); loadProjectList() }, [])

  async function loadProjectList() {
    try { setProjects(await montage.getProjects()) } catch {}
  }

  // ─── Gestion des blocs ─────────────────────────────────────────────────

  function addBlockToTrack(trackId, file, label, duration = 5) {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    const lastBlock = track.blocks[track.blocks.length - 1]
    const start = lastBlock ? lastBlock.start + lastBlock.duration : 0
    const block = { id: uid(), file, label, start, duration, trimIn: 0, trimOut: 0 }
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, blocks: [...t.blocks, block] } : t))
    setSelectedBlock({ trackId, blockId: block.id })
  }

  function updateBlock(trackId, blockId, changes) {
    setTracks(prev => prev.map(t => t.id === trackId
      ? { ...t, blocks: t.blocks.map(b => b.id === blockId ? { ...b, ...changes } : b) }
      : t))
  }

  function removeBlock(trackId, blockId) {
    setTracks(prev => prev.map(t => t.id === trackId
      ? { ...t, blocks: t.blocks.filter(b => b.id !== blockId) }
      : t))
    if (selectedBlock?.trackId === trackId && selectedBlock?.blockId === blockId) setSelectedBlock(null)
  }

  function getBlock(trackId, blockId) {
    return tracks.find(t => t.id === trackId)?.blocks.find(b => b.id === blockId)
  }

  function getTotalDuration() {
    let max = 10
    for (const t of tracks) {
      for (const b of t.blocks) {
        const end = b.start + b.duration
        if (end > max) max = end
      }
    }
    return max
  }

  const totalDuration = getTotalDuration()

  // ─── Déplacement des blocs ────────────────────────────────────────────

  function startBlockDrag(e, trackId, blockId) {
    e.preventDefault()
    const block = getBlock(trackId, blockId)
    if (!block) return
    const startX = e.clientX
    const origStart = block.start

    function onMove(ev) {
      const dx = (ev.clientX - startX) / SCALE
      const newStart = Math.max(0, origStart + dx)
      // Snap à 0.1s
      updateBlock(trackId, blockId, { start: Math.round(newStart * 10) / 10 })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ─── Lecture ──────────────────────────────────────────────────────────

  function togglePlay() {
    if (playing) { stopPlay(); return }
    setPlaying(true)
    setPlayTime(0)
    playStartTimeRef.current = Date.now()
    playIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - playStartTimeRef.current) / 1000
      setPlayTime(elapsed)
      if (elapsed >= totalDuration) stopPlay()
    }, 50)
  }

  function stopPlay() {
    setPlaying(false)
    setPlayTime(0)
    if (playIntervalRef.current) { clearInterval(playIntervalRef.current); playIntervalRef.current = null }
  }

  useEffect(() => { return () => stopPlay() }, [])

  // ─── Export ───────────────────────────────────────────────────────────

  async function handleExport() {
    try {
      const result = await montage.exportMontage({ tracks })
      setExportUrl(result.url + '?download=1')
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
    } catch {}
  }

  // ─── Upload ───────────────────────────────────────────────────────────

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await montage.uploadFile(file)
      setSources(prev => ({ ...prev, uploads: [...prev.uploads, { name: result.name, file: result.file, label: result.name }] }))
      // Ajouter automatiquement à la piste musique
      addBlockToTrack('music', result.file, result.name, 10)
    } catch { alert('Erreur upload') }
  }

  // ─── Bloc sélectionné ─────────────────────────────────────────────────

  const selBlock = selectedBlock ? getBlock(selectedBlock.trackId, selectedBlock.blockId) : null

  // ─── Rendu ────────────────────────────────────────────────────────────

  const timelineWidth = Math.max(totalDuration * SCALE + 100, 800)

  return (
    <div className="max-w-full mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">🎬 Montage audio</h1>
        <div className="flex gap-2 items-center">
          <input className={inputCls + ' w-40'} value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Nom du projet" />
          <button className={btnCls} onClick={handleSave}>💾</button>
          <select className={inputCls + ' w-32'} onChange={e => e.target.value && handleLoad(e.target.value)} value="">
            <option value="">📂 Charger…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.blockCount} blocs)</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3" style={{ height: 'calc(100vh - 160px)' }}>
        {/* ── Sources (gauche) ───────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 overflow-y-auto space-y-2 bg-white rounded-lg border border-gray-200 p-3">
          <h2 className="text-xs font-semibold text-gray-700 mb-2">📦 Sources</h2>

          {/* Sessions vocales */}
          <details className="text-xs" open>
            <summary className="font-medium text-gray-600 cursor-pointer">🎙️ Sessions vocales</summary>
            <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
              {sources.vocal.map(s => (
                <details key={s.sessionId} className="text-xs ml-2">
                  <summary className="text-gray-500 cursor-pointer truncate">{new Date(s.createdAt).toLocaleDateString()} — {s.chunks.length} seg.</summary>
                  <div className="ml-2 space-y-0.5">
                    {s.chunks.map((c, i) => (
                      <button key={i} className="block w-full text-left text-gray-600 hover:bg-indigo-50 rounded px-1 py-0.5 truncate"
                        onClick={() => addBlockToTrack('voice', c.file, c.text?.slice(0, 60) || `Seg. ${i + 1}`, c.duration || 5)}
                        title={c.text}>🎵 {c.text?.slice(0, 40) || `Seg. ${i + 1}`} ({c.duration || '?'}s)</button>
                    ))}
                  </div>
                </details>
              ))}
              {sources.vocal.length === 0 && <p className="text-gray-400">Aucune session</p>}
            </div>
          </details>

          {/* Uploads */}
          <details className="text-xs" open>
            <summary className="font-medium text-gray-600 cursor-pointer">📁 Uploads</summary>
            <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
              {sources.uploads.map((u, i) => (
                <button key={i} className="block w-full text-left text-gray-600 hover:bg-green-50 rounded px-1 py-0.5 truncate"
                  onClick={() => addBlockToTrack('music', u.file, u.label, 10)}
                  title={u.name}>🎧 {u.label}</button>
              ))}
              {sources.uploads.length === 0 && <p className="text-gray-400">Aucun upload</p>}
            </div>
          </details>

          <label className="block text-center py-1.5 border-2 border-dashed border-gray-300 rounded text-xs text-gray-400 hover:border-indigo-400 cursor-pointer mt-2">
            + Importer un fichier
            <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>

        {/* ── Timeline (centre) ──────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-auto relative" ref={timelineRef}>
          {/* Règle du temps */}
          <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 h-6 flex items-end" style={{ width: timelineWidth }}>
            {Array.from({ length: Math.ceil(totalDuration) + 2 }, (_, i) => (
              <div key={i} className="absolute text-[10px] text-gray-400" style={{ left: i * SCALE, bottom: 2 }}>
                {i}s
              </div>
            ))}
          </div>

          {/* Curseur de lecture */}
          {playing && (
            <div className="absolute top-6 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none" style={{ left: playTime * SCALE }} />
          )}

          {/* Pistes */}
          <div style={{ width: timelineWidth, paddingBottom: 40 }}>
            {tracks.map(track => (
              <div key={track.id} className="border-b border-gray-100 relative" style={{ minHeight: 64, backgroundColor: track.type === 'voice' ? '#fafbfc' : track.type === 'music' ? '#f8fdf9' : '#fffdf7' }}>
                <div className="sticky left-0 w-24 text-xs text-gray-500 py-1 px-2 bg-white/80">{TRACK_NAMES[track.type]}</div>
                {track.blocks.map(block => {
                  const isSel = selectedBlock?.trackId === track.id && selectedBlock?.blockId === block.id
                  const effectiveDur = Math.max(0.3, block.duration - block.trimIn - block.trimOut)
                  const w = Math.max(MIN_BLOCK_W, effectiveDur * SCALE)
                  const trimInW = (block.trimIn || 0) * SCALE
                  const trimOutW = (block.trimOut || 0) * SCALE
                  return (
                    <div key={block.id}
                      className={`absolute top-2 h-14 rounded border-2 cursor-pointer group ${isSel ? 'border-indigo-500 ring-2 ring-indigo-200 z-10' : 'border-gray-300 hover:border-gray-400'}`}
                      style={{ left: block.start * SCALE, width: w + trimInW + trimOutW, backgroundColor: TRACK_COLORS[track.type] }}
                      onClick={() => setSelectedBlock({ trackId: track.id, blockId: block.id })}
                      onMouseDown={e => startBlockDrag(e, track.id, block.id)}
                    >
                      {/* Zone trimmée gauche */}
                      {trimInW > 0 && <div className="absolute left-0 top-0 h-full bg-gray-300/60 rounded-l" style={{ width: trimInW }} />}
                      {/* Zone trimmée droite */}
                      {trimOutW > 0 && <div className="absolute right-0 top-0 h-full bg-gray-300/60 rounded-r" style={{ width: trimOutW }} />}
                      {/* Zone active */}
                      <div className="absolute top-0 h-full flex items-center px-1 overflow-hidden" style={{ left: trimInW, width: w }}>
                        <span className="text-[10px] text-gray-700 truncate">{block.label}</span>
                      </div>
                      {/* Bouton supprimer */}
                      <button className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center"
                        onClick={e => { e.stopPropagation(); removeBlock(track.id, block.id) }}>✕</button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Propriétés (droite) ─────────────────────────────────────── */}
        <div className="w-48 flex-shrink-0 bg-white rounded-lg border border-gray-200 p-3 overflow-y-auto text-xs space-y-3">
          <h2 className="font-semibold text-gray-700">✏️ Propriétés</h2>
          {selBlock ? (
            <>
              <p className="text-gray-600 truncate">{selBlock.label}</p>
              <div>
                <label className="text-gray-500">Début</label>
                <input type="number" className={inputCls} step={0.1} min={0} value={selBlock.start}
                  onChange={e => updateBlock(selectedBlock.trackId, selectedBlock.blockId, { start: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-gray-500">Trim début (s)</label>
                <input type="range" className="w-full" min={0} max={selBlock.duration - (selBlock.trimOut || 0) - 0.3} step={0.1} value={selBlock.trimIn || 0}
                  onChange={e => updateBlock(selectedBlock.trackId, selectedBlock.blockId, { trimIn: parseFloat(e.target.value) || 0 })} />
                <span className="text-gray-400">{selBlock.trimIn || 0}s</span>
              </div>
              <div>
                <label className="text-gray-500">Trim fin (s)</label>
                <input type="range" className="w-full" min={0} max={selBlock.duration - (selBlock.trimIn || 0) - 0.3} step={0.1} value={selBlock.trimOut || 0}
                  onChange={e => updateBlock(selectedBlock.trackId, selectedBlock.blockId, { trimOut: parseFloat(e.target.value) || 0 })} />
                <span className="text-gray-400">{selBlock.trimOut || 0}s</span>
              </div>
              <p className="text-gray-400">Effectif: {(selBlock.duration - (selBlock.trimIn || 0) - (selBlock.trimOut || 0)).toFixed(1)}s</p>
              <button className={btnSmall + ' w-full'} onClick={() => removeBlock(selectedBlock.trackId, selectedBlock.blockId)}>🗑️ Supprimer</button>
            </>
          ) : (
            <p className="text-gray-400">Sélectionnez un bloc</p>
          )}
        </div>
      </div>

      {/* ── Contrôles (bas) ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-2">
        <button className={btnCls + ' text-base px-4'} onClick={togglePlay}>{playing ? '⏹️' : '▶️'} {playing ? `${playTime.toFixed(1)}s` : 'Lecture'}</button>
        <button className={btnCls + ' !bg-green-600 hover:!bg-green-700'} onClick={handleExport}>📥 Exporter MP3</button>
        {exportUrl && <a href={exportUrl} className="text-xs text-green-600 font-medium" download>Télécharger</a>}
        <div className="flex-1" />
        <span className="text-xs text-gray-400">Total: {totalDuration.toFixed(1)}s • {tracks.reduce((s, t) => s + t.blocks.length, 0)} blocs</span>
      </div>
    </div>
  )
}
