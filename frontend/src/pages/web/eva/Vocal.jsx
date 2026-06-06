import { useState, useEffect, useRef, useCallback } from 'react'
import { vocal } from '../../../shared/api.js'

const inputCls = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'
const btnCls   = 'px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
const btnSecondary = 'px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors'
const cardCls = 'bg-white rounded-lg border border-gray-200 p-4'

export default function Vocal() {
  // Texte + params
  const [text, setText] = useState('')
  const [mode, setMode]       = useState('sentences')
  const [chunkSize, setChunkSize] = useState(3)
  const [format, setFormat]   = useState('wav')
  const [speed, setSpeed]     = useState(1.0)

  // État
  const [status, setStatus]   = useState('idle') // idle|generating|playing|paused|done|error
  const [errorMsg, setErrorMsg] = useState(null)

  // Session en cours
  const [sessionId, setSessionId]     = useState(null)
  const [chunkTotal, setChunkTotal]   = useState(0)
  const [chunkCurrent, setChunkCurrent] = useState(0)
  const [chunks, setChunks]           = useState([])
  const [currentPlayIdx, setCurrentPlayIdx] = useState(-1)
  const [estimatedMin, setEstimatedMin] = useState(0)
  const [mergeUrl, setMergeUrl] = useState(null)
  const [receivedCount, setReceivedCount] = useState(0)

  // Sessions passées
  const [pastSessions, setPastSessions] = useState([])

  // Refs
  const audioRef = useRef(null)
  const pollRef = useRef(null)
  const waitingRef = useRef(false)
  const sinceRef = useRef(0)
  const playIdxRef = useRef(-1)
  const chunksRef = useRef([])
  const audioUnlockedRef = useRef(false)

  // Sync refs
  useEffect(() => { playIdxRef.current = currentPlayIdx }, [currentPlayIdx])
  useEffect(() => { chunksRef.current = chunks }, [chunks])

  // Config + sessions au montage
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

  // ─── Audio unlock ───────────────────────────────────────────────────────

  function unlockAudio() {
    if (audioUnlockedRef.current || !audioRef.current) return
    const a = audioRef.current
    // Jouer un silence pour déverrouiller l'autoplay
    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    a.play().then(() => { a.pause(); a.src = ''; a.currentTime = 0; audioUnlockedRef.current = true }).catch(() => {})
  }

  // ─── Génération ────────────────────────────────────────────────────────

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
      const data = await vocal.generate(text, { mode, size: chunkSize, format, speed })
      setSessionId(data.sessionId); setChunkTotal(data.chunkCount)
      setEstimatedMin(data.estimatedMinutes || 0)
      setChunks(Array.from({ length: data.chunkCount }, (_, i) => ({
        index: i, url: null, text: '', duration: 0, status: 'pending'
      })))
      pollRef.current = setInterval(() => poll(data.sessionId), 1200)
    } catch (err) {
      setErrorMsg(err.message); setStatus('error')
    }
  }, [text, mode, chunkSize, format, speed, status])

  const poll = useCallback(async (sid) => {
    try {
      const data = await vocal.getStatus(sid, sinceRef.current)
      if (data.newChunks?.length) {
        for (const c of data.newChunks) {
          setChunks(prev => { const n = [...prev]; if (n[c.index]) n[c.index] = { ...c }; return n })
          sinceRef.current = Math.max(sinceRef.current, c.index + 1)
        }
        setReceivedCount(prev => prev + data.newChunks.length)
        // Auto-play si premier chunk ou si on attendait
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
    } catch {}
  }, [])

  const stopGeneration = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (audioRef.current) audioRef.current.pause()
    setStatus('idle')
  }, [])

  // ─── Lecture audio ─────────────────────────────────────────────────────

  const doPlay = useCallback((idx) => {
    const chunk = chunksRef.current[idx]
    if (!chunk?.url || chunk.status === 'error') {
      // Chercher le suivant
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
      // Reprendre avec gesture utilisateur
      if (audioRef.current.src && audioRef.current.currentTime > 0) {
        audioRef.current.play().then(() => setStatus('playing')).catch(() => {})
      } else if (currentPlayIdx >= 0) {
        doPlay(currentPlayIdx)
      }
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

  // ─── Replay session passée ─────────────────────────────────────────────

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

  // ─── Rendu ─────────────────────────────────────────────────────────────

  const progressPct = chunkTotal > 0 ? Math.round((receivedCount / chunkTotal) * 100) : 0
  const estimatedChunks = (() => {
    if (!text.trim()) return 0
    if (mode === 'sentences') { const s = text.split(/[.!?…]\s+/).filter(Boolean); return Math.ceil(s.length / chunkSize) }
    const w = text.split(/\s+/).filter(Boolean); return Math.ceil(w.length / chunkSize)
  })()

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">🎙️ Vocal TTS</h1>
      <p className="text-sm text-gray-500 -mt-2">Convertissez un texte en audio via Piper TTS. Découpage en segments lus séquentiellement.</p>

      {/* Zone texte */}
      <div className={cardCls}>
        <label className="block text-sm font-medium text-gray-700 mb-1">Texte à vocaliser</label>
        <textarea className={inputCls + ' h-48 resize-y font-mono text-xs'}
          placeholder="Collez votre texte ici (livre, article, chapitre…)" value={text}
          onChange={e => setText(e.target.value)} disabled={status === 'generating'} />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{text.length.toLocaleString()} car. {estimatedChunks > 0 && `— ~${estimatedChunks} segments`}</span>
          {text.trim() && <span className="text-xs text-gray-400">~{Math.ceil(text.trim().length / 15 / 60)} min audio</span>}
        </div>
      </div>

      {/* Paramètres */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Paramètres</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Découpage</label>
            <select className={inputCls} value={mode} onChange={e => { setMode(e.target.value); setChunkSize(e.target.value === 'sentences' ? 3 : 100) }} disabled={status === 'generating'}>
              <option value="sentences">Par phrases</option><option value="words">Par mots</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{mode === 'sentences' ? 'Phrases/seg.' : 'Mots/seg.'}</label>
            <input type="number" className={inputCls} value={chunkSize} onChange={e => setChunkSize(Math.max(1, parseInt(e.target.value) || 1))} min={1} max={mode === 'sentences' ? 20 : 500} disabled={status === 'generating'} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Format</label>
            <select className={inputCls} value={format} onChange={e => setFormat(e.target.value)} disabled={status === 'generating'}>
              <option value="wav">WAV</option><option value="mp3">MP3</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vitesse {speed.toFixed(1)}x</label>
            <input type="range" className="w-full" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} min={0.5} max={2.0} step={0.1} disabled={status === 'generating'} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap items-center">
        {status === 'idle' || status === 'done' || status === 'error' ? (
          <button className={btnCls} onClick={() => { unlockAudio(); startGeneration() }} disabled={!text.trim()}>🎬 Générer</button>
        ) : (
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700" onClick={stopGeneration}>⏹️ Arrêter</button>
        )}

        {/* Gros bouton play si paused (autoplay bloqué) */}
        {status === 'paused' && (
          <button className="px-6 py-3 bg-green-600 text-white rounded-xl text-base font-bold hover:bg-green-700 animate-pulse" onClick={togglePlayPause}>
            ▶️ Lancer la lecture
          </button>
        )}

        {(status === 'playing' || status === 'done') && currentPlayIdx < chunkTotal && (
          <button className={btnSecondary} onClick={togglePlayPause}>
            {status === 'playing' ? '⏸️ Pause' : '▶️ Lire'}
          </button>
        )}

        {status !== 'idle' && <button className={btnSecondary} onClick={resetAll}>🔄 Nouveau</button>}
        {mergeUrl && <a href={mergeUrl} className={btnCls + ' !bg-green-600 hover:!bg-green-700'} download>📥 Télécharger ({format.toUpperCase()})</a>}
      </div>

      {/* Progression */}
      {chunkTotal > 0 && (
        <div className={cardCls}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">
              {status === 'generating' && `⏳ Génération… ${receivedCount}/${chunkTotal} segments`}
              {status === 'playing' && `🔊 Lecture… ${currentPlayIdx + 1}/${chunkTotal}`}
              {status === 'paused' && `⏸️ En pause — ${currentPlayIdx + 1}/${chunkTotal} (cliquez ▶️ Lancer la lecture)`}
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

      {/* Lecteur + liste chunks */}
      {chunks.length > 0 && (
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Segments</h2>
            <div className="flex items-center gap-1">
              <button className={btnSecondary} onClick={() => skipChunk(-1)} disabled={currentPlayIdx <= 0}>⏮</button>
              <button className={btnCls + ' !px-2 !py-1'} onClick={togglePlayPause}>
                {status === 'playing' ? '⏸️' : '▶️'}
              </button>
              <button className={btnSecondary} onClick={() => skipChunk(1)} disabled={currentPlayIdx >= chunkTotal - 1}>⏭</button>
              <span className="text-xs text-gray-500 ml-1">{currentPlayIdx + 1}/{chunkTotal}</span>
            </div>
          </div>

          <audio ref={audioRef} onEnded={onAudioEnded} onError={onAudioEnded} preload="auto" />

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
                  <span className={`flex-1 truncate ${isCurrent ? 'text-indigo-800 font-medium' : 'text-gray-600'}`}>{chunk.text || 'En attente…'}</span>
                  {chunk.duration > 0 && <span className="text-gray-400 flex-shrink-0">{chunk.duration}s</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sessions passées */}
      {pastSessions.length > 0 && status === 'idle' && (
        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">📚 Sessions passées</h2>
          <div className="space-y-1">
            {pastSessions.slice(0, 10).map(s => (
              <div key={s.sessionId} className="flex items-center justify-between p-2 rounded border border-gray-200 hover:bg-gray-50 text-xs">
                <div>
                  <span className="text-gray-700 font-medium">{new Date(s.createdAt).toLocaleString()}</span>
                  <span className="text-gray-400 ml-3">{s.chunkCount} segments • {s.format?.toUpperCase()} • ~{s.estimatedMinutes}min</span>
                </div>
                <div className="flex gap-1">
                  <button className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200" onClick={() => replaySession(s.sessionId)}>🔁 Rejouer</button>
                  <a href={`/api/vocal/download/${s.sessionId}`} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">📥</a>
                  <button className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200" onClick={async () => { await vocal.deleteSession(s.sessionId); loadPastSessions() }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
