import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { vocal } from '../../../shared/api.js'

const inputCls = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'
const btnCls   = 'px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
const btnSecondary = 'px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors'
const cardCls = 'bg-white rounded-lg border border-gray-200 p-4'

const VOICE_COLORS = [
  '#fef3c7','#dbeafe','#d1fae5','#ede9fe','#fce7f3',
  '#e0f2fe','#fef2f2','#f0fdf4','#faf5ff','#fff7ed',
  '#ffedd5','#ecfdf5','#eff6ff','#fdf2f8','#f3f4f6'
]

export default function Vocal() {
  // Texte + params
  const [text, setText] = useState('')
  const [mode, setMode]       = useState('sentences')
  const [chunkSize, setChunkSize] = useState(3)
  const [format, setFormat]   = useState('wav')
  const [speed, setSpeed]     = useState(1.0)
  const [provider, setProvider] = useState('piper')
  const [voiceId, setVoiceId] = useState('')
  const [mistralVoices, setMistralVoices] = useState([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voicesLoaded, setVoicesLoaded] = useState(false)

  // Assignations multi-voix : [{ start, end, voiceId }]
  const [assignments, setAssignments] = useState([])
  const textareaRef = useRef(null)

  // État génération
  const [status, setStatus]   = useState('idle')
  const [errorMsg, setErrorMsg] = useState(null)
  const [sessionId, setSessionId]     = useState(null)
  const [chunkTotal, setChunkTotal]   = useState(0)
  const [chunkCurrent, setChunkCurrent] = useState(0)
  const [chunks, setChunks]           = useState([])
  const [currentPlayIdx, setCurrentPlayIdx] = useState(-1)
  const [estimatedMin, setEstimatedMin] = useState(0)
  const [mergeUrl, setMergeUrl] = useState(null)
  const [receivedCount, setReceivedCount] = useState(0)
  const [pastSessions, setPastSessions] = useState([])

  // Refs
  const audioRef = useRef(null)
  const pollRef = useRef(null)
  const waitingRef = useRef(false)
  const sinceRef = useRef(0)
  const playIdxRef = useRef(-1)
  const chunksRef = useRef([])
  const audioUnlockedRef = useRef(false)

  useEffect(() => { playIdxRef.current = currentPlayIdx }, [currentPlayIdx])
  useEffect(() => { chunksRef.current = chunks }, [chunks])

  // ─── Config + sessions ──────────────────────────────────────────────────

  useEffect(() => {
    vocal.getConfig().then(cfg => {
      if (cfg.default_format) setFormat(cfg.default_format)
      if (cfg.default_speed)  setSpeed(parseFloat(cfg.default_speed))
    }).catch(() => {})
    loadPastSessions()
  }, [])

  async function loadPastSessions() {
    try { setPastSessions(await vocal.getSessions()) } catch {}
  }

  // ─── Voix Mistral ───────────────────────────────────────────────────────

  useEffect(() => {
    if (provider !== 'mistral') return
    setVoicesLoading(true); setVoicesLoaded(false)
    vocal.getMistralVoices().then(voices => {
      setMistralVoices(voices)
      const fr = voices.find(v => v.languages?.some(l => l.startsWith('fr')))
      setVoiceId(fr ? fr.id : (voices[0]?.id || ''))
      setVoicesLoading(false); setVoicesLoaded(true)
    }).catch(() => setVoicesLoading(false))
  }, [provider])

  function getVoiceColor(voiceId) {
    if (!voiceId) return '#f9fafb'
    const idx = mistralVoices.findIndex(v => v.id === voiceId)
    return idx >= 0 ? VOICE_COLORS[idx % VOICE_COLORS.length] : '#f9fafb'
  }

  // ─── Assignations de voix ───────────────────────────────────────────────

  function assignVoiceToSelection(selectedVoiceId) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (start === end) return // rien sélectionné

    // Filtrer les assignations qui ne chevauchent pas
    let newAssignments = assignments.filter(a => a.end <= start || a.start >= end)

    // Découper les assignations qui sont partiellement chevauchées
    for (const a of assignments) {
      if (a.start < start && a.end > start && a.end <= end) {
        newAssignments.push({ start: a.start, end: start, voiceId: a.voiceId })
      } else if (a.start >= start && a.start < end && a.end > end) {
        newAssignments.push({ start: end, end: a.end, voiceId: a.voiceId })
      } else if (a.start < start && a.end > end) {
        newAssignments.push({ start: a.start, end: start, voiceId: a.voiceId })
        newAssignments.push({ start: end, end: a.end, voiceId: a.voiceId })
      }
    }

    // Ajouter la nouvelle assignation
    newAssignments.push({ start, end, voiceId: selectedVoiceId })
    newAssignments.sort((a, b) => a.start - b.start)
    setAssignments(newAssignments)
  }

  function clearAssignment(index) {
    setAssignments(prev => prev.filter((_, i) => i !== index))
  }

  // ─── Construction des sections pour l'aperçu et la génération ───────────

  const previewSections = useMemo(() => {
    if (provider !== 'mistral' || !text) return []
    const sections = []
    let pos = 0
    for (const a of assignments) {
      if (a.start > pos) sections.push({ start: pos, end: a.start, voiceId: null })
      if (a.end > a.start) sections.push({ start: a.start, end: a.end, voiceId: a.voiceId })
      pos = Math.max(pos, a.end)
    }
    if (pos < text.length) sections.push({ start: pos, end: text.length, voiceId: null })
    return sections
  }, [text, assignments, provider])

  // ─── Estimation segments ────────────────────────────────────────────────

  const segmentEstimate = useMemo(() => {
    if (!text.trim()) return 0
    if (provider === 'mistral' && assignments.length > 0) {
      // Calculer par section
      let total = 0
      for (const sec of previewSections) {
        const t = text.slice(sec.start, sec.end)
        if (!t.trim()) continue
        if (mode === 'sentences') {
          const s = t.split(/[.!?…]\s+/).filter(Boolean)
          total += Math.ceil(s.length / chunkSize)
        } else {
          const w = t.split(/\s+/).filter(Boolean)
          total += Math.ceil(w.length / chunkSize)
        }
      }
      return total
    }
    // Mode simple
    if (mode === 'sentences') {
      const s = text.split(/[.!?…]\s+/).filter(Boolean)
      return Math.ceil(s.length / chunkSize)
    }
    const w = text.split(/\s+/).filter(Boolean)
    return Math.ceil(w.length / chunkSize)
  }, [text, mode, chunkSize, provider, assignments, previewSections])

  const audioEstimate = text.trim() ? Math.ceil(text.trim().length / 15 / 60) : 0

  // ─── Génération ─────────────────────────────────────────────────────────

  const buildSections = useCallback(() => {
    if (assignments.length === 0) return null
    const secs = []
    let pos = 0
    for (const a of assignments) {
      if (a.start > pos) secs.push({ text: text.slice(pos, a.start), voiceId: voiceId })
      if (a.end > a.start) secs.push({ text: text.slice(a.start, a.end), voiceId: a.voiceId })
      pos = Math.max(pos, a.end)
    }
    if (pos < text.length) secs.push({ text: text.slice(pos), voiceId })
    return secs.filter(s => s.text.trim())
  }, [text, assignments, voiceId])

  function unlockAudio() {
    if (audioUnlockedRef.current || !audioRef.current) return
    const a = audioRef.current
    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    a.play().then(() => { a.pause(); a.src = ''; a.currentTime = 0; audioUnlockedRef.current = true }).catch(() => {})
  }

  const startGeneration = useCallback(async () => {
    if (!text.trim() || status === 'generating') return
    unlockAudio()
    setErrorMsg(null); setChunks([]); setChunkCurrent(0); setChunkTotal(0)
    setCurrentPlayIdx(-1); setReceivedCount(0); setMergeUrl(null)
    setSessionId(null); setEstimatedMin(0); sinceRef.current = 0
    waitingRef.current = false
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    setStatus('generating')

    try {
      const payload = { mode, size: chunkSize, format, speed, provider, voiceId }
      if (provider === 'mistral') {
        const secs = buildSections()
        if (secs) payload.sections = secs
      }
      const data = await vocal.generate(payload.text || text, payload)
      setSessionId(data.sessionId); setChunkTotal(data.chunkCount)
      setEstimatedMin(data.estimatedMinutes || 0)
      setChunks(Array.from({ length: data.chunkCount }, (_, i) => ({
        index: i, url: null, text: '', duration: 0, status: 'pending'
      })))
      pollRef.current = setInterval(() => poll(data.sessionId), 1200)
    } catch (err) {
      setErrorMsg(err.message); setStatus('error')
    }
  }, [text, mode, chunkSize, format, speed, provider, voiceId, buildSections, status])

  const poll = useCallback(async (sid) => {
    try {
      const data = await vocal.getStatus(sid, sinceRef.current)
      if (data.newChunks?.length) {
        for (const c of data.newChunks) {
          setChunks(prev => { const n = [...prev]; if (n[c.index]) n[c.index] = { ...c }; return n })
          sinceRef.current = Math.max(sinceRef.current, c.index + 1)
        }
        setReceivedCount(prev => prev + data.newChunks.length)
        if (playIdxRef.current < 0 || waitingRef.current) {
          waitingRef.current = false
          setCurrentPlayIdx(data.newChunks[0].index)
        }
      }
      setChunkCurrent(data.currentIndex)
      if (data.status === 'done') {
        clearInterval(pollRef.current); pollRef.current = null
        setMergeUrl(data.mergeUrl); setChunkCurrent(data.chunkCount)
        loadPastSessions()
      }
    } catch (e) { console.error('Vocal poll error:', e) }
  }, [])

  const stopGeneration = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (audioRef.current) audioRef.current.pause()
    setStatus('idle')
  }, [])

  // ─── Lecture audio ──────────────────────────────────────────────────────

  const doPlay = useCallback((idx) => {
    const chunk = chunksRef.current[idx]
    if (!chunk?.url || chunk.status === 'error') {
      const next = chunksRef.current.findIndex((c, i) => i > idx && c.url && c.status !== 'error')
      if (next >= 0) setCurrentPlayIdx(next)
      else waitingRef.current = true
      return
    }
    if (!audioRef.current) return
    audioRef.current.src = chunk.url
    audioRef.current.play().then(() => setStatus('playing')).catch(() => setStatus('paused'))
    setChunks(prev => { const n = [...prev]; n[idx] = { ...n[idx], status: 'playing' }; return n })
  }, [])

  useEffect(() => {
    if (currentPlayIdx < 0 || !audioRef.current) return
    doPlay(currentPlayIdx)
  }, [currentPlayIdx, doPlay])

  const onAudioEnded = useCallback(() => {
    const idx = playIdxRef.current
    setChunks(prev => { const n = [...prev]; if (n[idx]) n[idx] = { ...n[idx], status: 'played' }; return n })
    const next = chunksRef.current.findIndex((c, i) => i > idx && c.url && c.status !== 'error')
    if (next >= 0) setCurrentPlayIdx(next)
    else if (!pollRef.current) setStatus('done')
    else waitingRef.current = true
  }, [])

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return
    if (status === 'playing') { audioRef.current.pause(); setStatus('paused') }
    else if (status === 'paused' || status === 'done') {
      if (audioRef.current.src && audioRef.current.currentTime > 0) {
        audioRef.current.play().then(() => setStatus('playing')).catch(() => {})
      } else if (currentPlayIdx >= 0) doPlay(currentPlayIdx)
    }
  }, [status, currentPlayIdx, doPlay])

  const skipChunk = useCallback((dir) => {
    const idx = playIdxRef.current + dir
    if (idx >= 0 && idx < chunkTotal) setCurrentPlayIdx(idx)
  }, [chunkTotal])

  const resetAll = useCallback(() => {
    stopGeneration()
    setChunks([]); setChunkCurrent(0); setChunkTotal(0)
    setCurrentPlayIdx(-1); setReceivedCount(0)
    setMergeUrl(null); setSessionId(null); setErrorMsg(null); setStatus('idle')
  }, [stopGeneration])

  async function replaySession(sid) {
    try {
      const m = await vocal.getManifest(sid)
      setChunks(m.chunks.map(c => ({ ...c, status: c.status === 'generated' ? 'generated' : c.status })))
      setChunkTotal(m.chunkCount); setReceivedCount(m.chunks.length)
      setEstimatedMin(m.estimatedMinutes || 0); setSessionId(sid)
      setStatus('done'); setMergeUrl(`/api/vocal/download/${sid}`)
      sinceRef.current = m.chunks.length; setChunkCurrent(m.chunkCount)
    } catch { setErrorMsg('Session introuvable') }
  }

  // ─── Rendu ──────────────────────────────────────────────────────────────

  const progressPct = chunkTotal > 0 ? Math.round((receivedCount / chunkTotal) * 100) : 0

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">🎙️ Vocal TTS</h1>
      <p className="text-sm text-gray-500 -mt-2">{provider === 'mistral' ? 'Sélectionnez du texte et assignez des voix différentes.' : 'Convertissez un texte en audio via Piper TTS.'}</p>

      {/* ── Zone texte + aperçu ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Textarea */}
        <div className={cardCls}>
          <label className="block text-sm font-medium text-gray-700 mb-2">Texte à vocaliser</label>
          <textarea
            ref={textareaRef}
            className="w-full min-h-[350px] rounded-xl border-2 border-gray-200 hover:border-indigo-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 p-4 text-sm leading-relaxed resize-y transition-all outline-none font-serif text-gray-700 bg-gray-50 placeholder:text-gray-400"
            placeholder="Écrivez ou collez votre texte ici…"
            value={text}
            onChange={e => { setText(e.target.value); setAssignments([]) }}
            disabled={status === 'generating'}
          />
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>{text.length.toLocaleString()} car.</span>
            <span>~{segmentEstimate} segments • ~{audioEstimate} min</span>
          </div>
        </div>

        {/* Aperçu coloré (Mistral uniquement) */}
        <div className={cardCls}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {provider === 'mistral' ? '🎨 Aperçu des voix' : 'ℹ️ Info'}
          </label>
          {provider === 'mistral' && previewSections.length > 0 ? (
            <div className="max-h-[350px] overflow-y-auto rounded-lg border border-gray-200 p-3 text-sm leading-relaxed font-serif whitespace-pre-wrap bg-white">
              {previewSections.map((sec, i) => (
                <span
                  key={i}
                  style={{ backgroundColor: getVoiceColor(sec.voiceId) }}
                  className="rounded px-0.5"
                  title={sec.voiceId ? mistralVoices.find(v => v.id === sec.voiceId)?.name || sec.voiceId : 'Narrateur (défaut)'}
                >
                  {text.slice(sec.start, sec.end)}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 p-4 border border-dashed border-gray-200 rounded-lg text-center">
              {provider === 'mistral'
                ? 'Sélectionnez du texte dans l\'éditeur, puis cliquez sur une voix dans la palette ci-dessous pour l\'assigner.'
                : 'Passez sur Mistral Voxtral pour utiliser l\'éditeur multi-voix.'}
            </div>
          )}

          {/* Assignations liste */}
          {provider === 'mistral' && assignments.length > 0 && (
            <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
              {assignments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getVoiceColor(a.voiceId) }} />
                  <span className="text-gray-600 truncate flex-1">«{text.slice(a.start, a.end).slice(0, 60)}…»</span>
                  <span className="text-gray-400">{mistralVoices.find(v => v.id === a.voiceId)?.name || a.voiceId}</span>
                  <button className="text-red-400 hover:text-red-600" onClick={() => clearAssignment(i)} disabled={status === 'generating'}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Palette de voix (Mistral) ──────────────────────────────────── */}
      {provider === 'mistral' && (
        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">🎤 Voix disponibles</h2>
          {voicesLoading ? (
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
              Chargement des voix…
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Narrateur (défaut) */}
              <button
                className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${!voiceId ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-400'}`}
                style={{ backgroundColor: '#f9fafb' }}
                onClick={() => setVoiceId('')}
                title="Voix par défaut (narrateur)"
              >
                🎭 Narrateur
              </button>
              {mistralVoices.map((v, i) => {
                const isDefault = v.id === voiceId
                return (
                  <button
                    key={v.id}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${isDefault ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-400'}`}
                    style={{ backgroundColor: VOICE_COLORS[i % VOICE_COLORS.length] }}
                    onClick={() => {
                      const sel = textareaRef.current
                      if (sel && sel.selectionStart !== sel.selectionEnd) {
                        assignVoiceToSelection(v.id)
                      } else {
                        setVoiceId(v.id)
                      }
                    }}
                    title={v.languages?.join(', ')}
                  >
                    {v.name}
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            💡 <b>Narrateur</b> : voix par défaut. Sélectionnez du texte puis cliquez sur une voix pour l'assigner au passage.
          </p>
        </div>
      )}

      {/* ── Paramètres ─────────────────────────────────────────────────── */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Paramètres</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Synthèse</label>
            <select className={inputCls} value={provider} onChange={e => { setProvider(e.target.value); if (e.target.value === 'mistral') setFormat('mp3') }} disabled={status === 'generating'}>
              <option value="piper">Piper (local)</option>
              <option value="mistral">Mistral Voxtral</option>
            </select>
          </div>
          {provider === 'piper' ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Format</label>
              <select className={inputCls} value={format} onChange={e => setFormat(e.target.value)} disabled={status === 'generating'}>
                <option value="wav">WAV</option><option value="mp3">MP3</option></select>
            </div>
          ) : null}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Découpage</label>
            <select className={inputCls} value={mode} onChange={e => { setMode(e.target.value); setChunkSize(e.target.value === 'sentences' ? 3 : 100) }} disabled={status === 'generating'}>
              <option value="sentences">Par phrases</option><option value="words">Par mots</option></select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{mode === 'sentences' ? 'Phrases/seg.' : 'Mots/seg.'}</label>
            <input type="number" className={inputCls} value={chunkSize} onChange={e => setChunkSize(Math.max(1, parseInt(e.target.value) || 1))} min={1} max={mode === 'sentences' ? 20 : 500} disabled={status === 'generating'} />
          </div>
          {provider === 'piper' && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Vitesse {speed.toFixed(1)}x</label>
                <input type="range" className="w-full" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} min={0.5} max={2.0} step={0.1} disabled={status === 'generating'} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap items-center">
        {status === 'idle' || status === 'done' || status === 'error' ? (
          <button className={btnCls} onClick={() => { unlockAudio(); startGeneration() }}
            disabled={!text.trim() || (provider === 'mistral' && !voiceId) || (provider === 'mistral' && voicesLoading)}>
            🎬 Générer
          </button>
        ) : (
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700" onClick={stopGeneration}>⏹️ Arrêter</button>
        )}
        {status === 'paused' && (
          <button className="px-6 py-3 bg-green-600 text-white rounded-xl text-base font-bold hover:bg-green-700 animate-pulse" onClick={togglePlayPause}>▶️ Lancer la lecture</button>
        )}
        {(status === 'playing' || status === 'done') && currentPlayIdx < chunkTotal && (
          <button className={btnSecondary} onClick={togglePlayPause}>{status === 'playing' ? '⏸️ Pause' : '▶️ Lire'}</button>
        )}
        {status !== 'idle' && <button className={btnSecondary} onClick={resetAll}>🔄 Nouveau</button>}
        {mergeUrl && <a href={mergeUrl} className={btnCls + ' !bg-green-600 hover:!bg-green-700'} download>📥 Télécharger ({format.toUpperCase()})</a>}
      </div>

      {/* ── Progression ────────────────────────────────────────────────── */}
      {chunkTotal > 0 && (
        <div className={cardCls}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">
              {status === 'generating' && `⏳ Génération… ${receivedCount}/${chunkTotal}`}
              {status === 'playing' && `🔊 Lecture… ${currentPlayIdx + 1}/${chunkTotal}`}
              {status === 'paused' && `⏸️ Pause — ${currentPlayIdx + 1}/${chunkTotal}`}
              {status === 'done' && `✅ Terminé — ${chunkTotal} segments`}
            </span>
            <span className="text-gray-400">{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${status === 'error' ? 'bg-red-500' : status === 'done' ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progressPct}%` }} />
          </div>
          {estimatedMin > 0 && <p className="text-xs text-gray-400 mt-1">~{estimatedMin} min audio • ~{Math.ceil(estimatedMin / 2.5)} min génération</p>}
        </div>
      )}

      {errorMsg && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{errorMsg}</div>}

      {/* ── Segments ────────────────────────────────────────────────────── */}
      {chunks.length > 0 && (
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Segments</h2>
            <div className="flex items-center gap-1">
              <button className={btnSecondary} onClick={() => skipChunk(-1)} disabled={currentPlayIdx <= 0}>⏮</button>
              <button className={btnCls + ' !px-2 !py-1'} onClick={togglePlayPause}>{status === 'playing' ? '⏸️' : '▶️'}</button>
              <button className={btnSecondary} onClick={() => skipChunk(1)} disabled={currentPlayIdx >= chunkTotal - 1}>⏭</button>
              <span className="text-xs text-gray-500 ml-1">{currentPlayIdx + 1}/{chunkTotal}</span>
            </div>
          </div>
          <audio ref={audioRef} onEnded={onAudioEnded} onError={(e) => { console.error('Audio error:', audioRef.current?.error); onAudioEnded() }} preload="auto" />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {chunks.map((chunk, i) => {
              const isCurrent = i === currentPlayIdx
              const bg = isCurrent && (status === 'playing' || status === 'paused') ? 'bg-indigo-50 border-indigo-300'
                : chunk.status === 'played' ? 'bg-gray-50 border-gray-200'
                : chunk.status === 'error' ? 'bg-red-50 border-red-200'
                : chunk.status === 'generated' ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-100'

              return (
                <div key={i} className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer ${bg} ${isCurrent ? 'ring-2 ring-indigo-300' : ''}`}
                  onClick={() => { setCurrentPlayIdx(i); doPlay(i) }}>
                  <span className="text-gray-400 w-6 text-right flex-shrink-0">{i + 1}</span>
                  <span className="flex-shrink-0 w-4 text-center">
                    {isCurrent && status === 'playing' ? '🔊' : isCurrent && status === 'paused' ? '⏸️' : chunk.status === 'played' ? '✅' : chunk.status === 'generated' ? '🎵' : chunk.status === 'error' ? '❌' : '⏳'}
                  </span>
                  {chunk.voiceId && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: getVoiceColor(chunk.voiceId) }} title={mistralVoices.find(v => v.id === chunk.voiceId)?.name || chunk.voiceId} />
                  )}
                  <span className={`flex-1 truncate ${isCurrent ? 'text-indigo-800 font-medium' : 'text-gray-600'}`}>{chunk.text || 'En attente…'}</span>
                  {chunk.duration > 0 && <span className="text-gray-400 flex-shrink-0">{chunk.duration}s</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sessions passées ────────────────────────────────────────────── */}
      {pastSessions.length > 0 && (
        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">📚 Sessions passées</h2>
          <div className="space-y-1">
            {pastSessions.slice(0, 10).map(s => (
              <div key={s.sessionId} className="flex items-center justify-between p-2 rounded border border-gray-200 hover:bg-gray-50 text-xs">
                <div>
                  <span className="text-gray-700 font-medium">{new Date(s.createdAt).toLocaleString()}</span>
                  <span className="text-gray-400 ml-2">{s.provider === 'mistral' ? '🤖' : '🔊'} {s.provider === 'mistral' ? 'Voxtral' : 'Piper'}</span>
                  <span className="text-gray-400 ml-2">{s.chunkCount} seg. • {s.format?.toUpperCase()} • ~{s.estimatedMinutes}min</span>
                </div>
                <div className="flex gap-1">
                  <button className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200" onClick={() => replaySession(s.sessionId)}>🔁 Rejouer</button>
                  <a href={`/api/vocal/download/${s.sessionId}`} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">📥</a>
                  <button className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200" onClick={() => { vocal.deleteSession(s.sessionId).then(loadPastSessions) }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
