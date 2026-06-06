import { useState, useEffect, useRef, useCallback } from 'react'
import { vocal } from '../../../shared/api.js'

const inputCls = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'
const btnCls   = 'px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
const btnSecondary = 'px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors'
const cardCls = 'bg-white rounded-lg border border-gray-200 p-4'

export default function Vocal() {
  const [text, setText] = useState('')
  const [mode, setMode]       = useState('sentences')
  const [chunkSize, setChunkSize] = useState(3)
  const [format, setFormat]   = useState('wav')
  const [speed, setSpeed]     = useState(1.0)

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

  const audioRef = useRef(null)
  const pollRef = useRef(null)
  const waitingForNextRef = useRef(false)
  const sinceRef = useRef(0)
  const currentPlayIdxRef = useRef(-1)
  const chunksRef = useRef([])

  // Config au montage
  useEffect(() => {
    vocal.getConfig().then(cfg => {
      if (cfg.default_format) setFormat(cfg.default_format)
      if (cfg.default_speed)  setSpeed(parseFloat(cfg.default_speed))
    }).catch(() => {})
  }, [])

  // Estimation
  const estimatedChunks = (() => {
    if (!text.trim()) return 0
    if (mode === 'sentences') {
      const sentences = text.split(/[.!?…]\s+/).filter(Boolean)
      return Math.ceil(sentences.length / chunkSize)
    }
    const words = text.split(/\s+/).filter(Boolean)
    return Math.ceil(words.length / chunkSize)
  })()

  // ─── Génération ──────────────────────────────────────────────────────────

  const startGeneration = useCallback(async () => {
    if (!text.trim() || status === 'generating') return

    setErrorMsg(null)
    setChunks([])
    setChunkCurrent(0)
    setChunkTotal(0)
    setCurrentPlayIdx(-1)
    setReceivedCount(0)
    setMergeUrl(null)
    setSessionId(null)
    setEstimatedMin(0)
    sinceRef.current = 0
    waitingForNextRef.current = false
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }

    setStatus('generating')

    // Déverrouiller l'audio (politique autoplay navigateur)
    if (audioRef.current) {
      audioRef.current.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
      await audioRef.current.play().then(() => { audioRef.current.pause(); audioRef.current.src = '' }).catch(() => {})
    }

    try {
      const data = await vocal.generate(text, { mode, size: chunkSize, format, speed })
      setSessionId(data.sessionId)
      setChunkTotal(data.chunkCount)
      setEstimatedMin(data.estimatedMinutes || 0)
      setChunks(Array.from({ length: data.chunkCount }, (_, i) => ({
        index: i, url: null, text: '', duration: 0, status: 'pending'
      })))

      // Démarrer le polling
      pollRef.current = setInterval(() => poll(data.sessionId), 1500)
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }, [text, mode, chunkSize, format, speed, status])

  // Sync refs avec state
  useEffect(() => { currentPlayIdxRef.current = currentPlayIdx }, [currentPlayIdx])
  useEffect(() => { chunksRef.current = chunks }, [chunks])

  const poll = useCallback(async (sid) => {
    try {
      const data = await vocal.getStatus(sid, sinceRef.current)

      if (data.newChunks && data.newChunks.length > 0) {
        for (const c of data.newChunks) {
          setChunks(prev => {
            const next = [...prev]
            if (next[c.index]) next[c.index] = { ...c }
            return next
          })
          sinceRef.current = Math.max(sinceRef.current, c.index + 1)
        }
        setReceivedCount(prev => prev + data.newChunks.length)

        // Auto-play si rien ne joue ou si on attendait le suivant
        if (currentPlayIdxRef.current < 0 || waitingForNextRef.current) {
          waitingForNextRef.current = false
          setCurrentPlayIdx(data.newChunks[0].index)
        }
      }

      setChunkCurrent(data.currentIndex)

      if (data.status === 'done') {
        clearInterval(pollRef.current)
        pollRef.current = null
        setMergeUrl(data.mergeUrl)
        setChunkCurrent(data.chunkCount)
      }
    } catch {
      // Réessaie au prochain poll
    }
  }, [])

  // Nettoyer le polling au démontage
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const stopGeneration = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (audioRef.current) audioRef.current.pause()
    setStatus('idle')
  }, [])

  // ─── Lecture séquentielle ────────────────────────────────────────────────

  useEffect(() => {
    if (currentPlayIdx < 0) return
    const chunk = chunks[currentPlayIdx]
    if (!chunk || !chunk.url || chunk.status === 'error') {
      const next = chunks.findIndex((c, i) => i > currentPlayIdx && c.url && c.status !== 'error')
      if (next >= 0) setCurrentPlayIdx(next)
      return
    }

    setChunks(prev => {
      const next = [...prev]
      next[currentPlayIdx] = { ...next[currentPlayIdx], status: 'playing' }
      return next
    })

    if (audioRef.current) {
      audioRef.current.src = chunk.url
      audioRef.current.play().catch(() => setStatus('paused'))
    }

    setStatus('playing')
  }, [currentPlayIdx, chunks])

  const onAudioEnded = useCallback(() => {
    const idx = currentPlayIdxRef.current
    const curChunks = chunksRef.current

    setChunks(prev => {
      const next = [...prev]
      if (next[idx]) next[idx] = { ...next[idx], status: 'played' }
      return next
    })

    const next = curChunks.findIndex((c, i) => i > idx && c.url && c.status !== 'error')
    if (next >= 0) {
      setCurrentPlayIdx(next)
    } else if (pollRef.current === null) {
      setStatus('done')
    } else {
      waitingForNextRef.current = true
    }
  }, [])

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return
    if (status === 'playing') { audioRef.current.pause(); setStatus('paused') }
    else if (status === 'paused') { audioRef.current.play().catch(() => {}); setStatus('playing') }
  }, [status])

  const skipChunk = useCallback((dir) => {
    const nextIdx = currentPlayIdx + dir
    if (nextIdx >= 0 && nextIdx < chunkTotal) {
      const target = chunks[nextIdx]
      if (target?.url && target.status !== 'error') setCurrentPlayIdx(nextIdx)
    }
  }, [currentPlayIdx, chunkTotal, chunks])

  const resetAll = useCallback(() => {
    stopGeneration()
    setChunks([]); setChunkCurrent(0); setChunkTotal(0)
    setCurrentPlayIdx(-1); setReceivedCount(0)
    setMergeUrl(null); setSessionId(null); setErrorMsg(null)
    setStatus('idle')
  }, [stopGeneration])

  // ─── Rendu ───────────────────────────────────────────────────────────────

  const progressPct = chunkTotal > 0 ? Math.round((receivedCount / chunkTotal) * 100) : 0

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">🎙️ Vocal TTS</h1>
      <p className="text-sm text-gray-500 -mt-2">
        Convertissez un texte en audio via Piper TTS. Le texte est découpé en segments lus séquentiellement.
      </p>

      {/* Zone de texte */}
      <div className={cardCls}>
        <label className="block text-sm font-medium text-gray-700 mb-1">Texte à vocaliser</label>
        <textarea
          className={inputCls + ' h-48 resize-y font-mono text-xs'}
          placeholder="Collez votre texte ici (livre, article, chapitre…)"
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={status === 'generating'}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-400">
            {text.length.toLocaleString()} caractères
            {estimatedChunks > 0 && ` — ~${estimatedChunks} segments`}
          </span>
          {text.trim() && (
            <span className="text-xs text-gray-400">
              ~{Math.ceil(text.trim().length / 15 / 60)} min d'audio estimées
            </span>
          )}
        </div>
      </div>

      {/* Paramètres */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Paramètres</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Découpage</label>
            <select className={inputCls} value={mode} onChange={e => { setMode(e.target.value); setChunkSize(e.target.value === 'sentences' ? 3 : 100) }} disabled={status === 'generating'}>
              <option value="sentences">Par phrases</option>
              <option value="words">Par mots</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{mode === 'sentences' ? 'Phrases / segment' : 'Mots / segment'}</label>
            <input type="number" className={inputCls} value={chunkSize} onChange={e => setChunkSize(Math.max(1, parseInt(e.target.value) || 1))} min={1} max={mode === 'sentences' ? 20 : 500} disabled={status === 'generating'} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Format</label>
            <select className={inputCls} value={format} onChange={e => setFormat(e.target.value)} disabled={status === 'generating'}>
              <option value="wav">WAV (qualité max)</option>
              <option value="mp3">MP3 (compressé)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vitesse : {speed.toFixed(1)}x</label>
            <input type="range" className="w-full" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} min={0.5} max={2.0} step={0.1} disabled={status === 'generating'} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {(status === 'idle' || status === 'done' || status === 'error') ? (
          <button className={btnCls} onClick={startGeneration} disabled={!text.trim()}>🎬 Générer l'audio</button>
        ) : (
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700" onClick={stopGeneration}>⏹️ Arrêter</button>
        )}
        {(status === 'playing' || status === 'paused') && (
          <button className={btnSecondary} onClick={togglePlayPause}>{status === 'playing' ? '⏸️ Pause' : '▶️ Reprendre'}</button>
        )}
        {status !== 'idle' && <button className={btnSecondary} onClick={resetAll}>🔄 Nouveau texte</button>}
        {mergeUrl && status === 'done' && (
          <a href={mergeUrl} className={btnCls + ' !bg-green-600 hover:!bg-green-700 inline-flex items-center gap-1'} download>📥 Télécharger ({format.toUpperCase()})</a>
        )}
      </div>

      {/* Progression */}
      {(status !== 'idle' || chunkTotal > 0) && (
        <div className={cardCls}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">
              {status === 'generating' && `Génération… ${receivedCount}/${chunkTotal} segments`}
              {status === 'playing' && `Lecture… ${currentPlayIdx + 1}/${chunkTotal}`}
              {status === 'paused' && `Pause — ${currentPlayIdx + 1}/${chunkTotal}`}
              {status === 'done' && `✅ Terminé — ${chunkTotal} segments`}
            </span>
            <span className="text-gray-400">{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all duration-500 ${status === 'error' ? 'bg-red-500' : status === 'done' ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progressPct}%` }} />
          </div>
          {estimatedMin > 0 && <p className="text-xs text-gray-400 mt-1">~{estimatedMin} min d'audio • ~{Math.ceil(estimatedMin / 3)} min de génération</p>}
        </div>
      )}

      {errorMsg && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{errorMsg}</div>}

      {/* Segments */}
      {chunks.length > 0 && (
        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Segments</h2>

          <audio ref={audioRef} onEnded={onAudioEnded} onError={onAudioEnded} className="hidden" />

          {(status === 'playing' || status === 'paused' || status === 'done') && (
            <div className="flex items-center gap-2 mb-3">
              <button className={btnSecondary} onClick={() => skipChunk(-1)} disabled={currentPlayIdx <= 0}>⏮</button>
              <button className={btnCls} onClick={togglePlayPause}>{status === 'playing' ? '⏸️' : '▶️'}</button>
              <button className={btnSecondary} onClick={() => skipChunk(1)} disabled={currentPlayIdx >= chunkTotal - 1}>⏭</button>
              <span className="text-xs text-gray-500 ml-2">Segment {currentPlayIdx + 1}/{chunkTotal}</span>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1">
            {chunks.map((chunk, i) => {
              const isCurrent = i === currentPlayIdx
              const bg = isCurrent && status === 'playing' ? 'bg-indigo-50 border-indigo-300'
                : chunk.status === 'played' ? 'bg-gray-50 border-gray-200'
                : chunk.status === 'error' ? 'bg-red-50 border-red-200'
                : chunk.status === 'generated' ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-100'

              return (
                <div key={i} className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${bg} ${isCurrent ? 'ring-2 ring-indigo-300' : ''}`}
                  onClick={() => {
                    if (chunk.url && chunk.status !== 'error') {
                      audioRef.current.src = chunk.url; audioRef.current.play().catch(() => {})
                      setCurrentPlayIdx(i); setStatus('playing')
                    }
                  }}>
                  <span className="text-gray-400 w-6 text-right flex-shrink-0">{i + 1}</span>
                  <span className="flex-shrink-0 w-5 text-center">
                    {chunk.status === 'playing' ? '🔊' : chunk.status === 'played' ? '✅' : chunk.status === 'generated' ? '🎵' : chunk.status === 'error' ? '❌' : '⏳'}
                  </span>
                  <span className={`flex-1 truncate ${isCurrent ? 'text-indigo-800 font-medium' : 'text-gray-600'}`}>{chunk.text || 'En attente…'}</span>
                  {chunk.duration > 0 && <span className="text-gray-400 flex-shrink-0">{chunk.duration}s</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
