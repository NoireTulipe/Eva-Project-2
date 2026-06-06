import { useState, useEffect, useRef, useCallback } from 'react'
import { vocal } from '../../../shared/api.js'

// ─── Constantes ──────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'
const btnCls   = 'px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
const btnSecondary = 'px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors'
const cardCls = 'bg-white rounded-lg border border-gray-200 p-4'

// ─── Composant ───────────────────────────────────────────────────────────────

export default function Vocal() {
  // Texte
  const [text, setText] = useState('')

  // Paramètres
  const [mode, setMode]       = useState('sentences')
  const [chunkSize, setChunkSize] = useState(3)
  const [format, setFormat]   = useState('wav')
  const [speed, setSpeed]     = useState(1.0)

  // État
  const [status, setStatus]   = useState('idle') // idle | generating | playing | paused | done | error
  const [errorMsg, setErrorMsg] = useState(null)

  // Progression
  const [sessionId, setSessionId]     = useState(null)
  const [chunkTotal, setChunkTotal]   = useState(0)
  const [chunkCurrent, setChunkCurrent] = useState(0)
  const [chunks, setChunks]           = useState([]) // [{ index, url, text, duration, status: 'pending'|'generated'|'playing'|'played'|'error' }]
  const [currentPlayIdx, setCurrentPlayIdx] = useState(-1)
  const [estimatedMin, setEstimatedMin] = useState(0)
  const [totalGenerated, setTotalGenerated] = useState(0)
  const [mergeUrl, setMergeUrl] = useState(null)

  // Audio
  const audioRef = useRef(null)
  const cancelRef = useRef(null)
  const waitingForNextRef = useRef(false)

  // Config au montage
  useEffect(() => {
    vocal.getConfig().then(cfg => {
      if (cfg.default_format) setFormat(cfg.default_format)
      if (cfg.default_speed)  setSpeed(parseFloat(cfg.default_speed))
    }).catch(() => {})
  }, [])

  // ─── Estimation ──────────────────────────────────────────────────────────

  const estimatedChunks = (() => {
    if (!text.trim()) return 0
    if (mode === 'sentences') {
      const sentences = text.split(/[.!?…]\s+/).filter(Boolean)
      return Math.ceil(sentences.length / chunkSize)
    } else {
      const words = text.split(/\s+/).filter(Boolean)
      return Math.ceil(words.length / chunkSize)
    }
  })()

  // ─── Génération ──────────────────────────────────────────────────────────

  const startGeneration = useCallback(() => {
    if (!text.trim()) return
    if (status === 'generating') return

    // Reset
    waitingForNextRef.current = false
    setErrorMsg(null)
    setChunks([])
    setChunkCurrent(0)
    setChunkTotal(0)
    setCurrentPlayIdx(-1)
    setTotalGenerated(0)
    setMergeUrl(null)
    setSessionId(null)
    setEstimatedMin(0)
    setStatus('generating')

    // Arrêter toute lecture en cours
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    const cancel = vocal.generate(text, { mode, size: chunkSize, format, speed }, (event) => {
      switch (event.type) {
        case 'start':
          setSessionId(event.sessionId)
          setChunkTotal(event.chunkCount)
          setEstimatedMin(event.estimatedMinutes || 0)
          // Pré-remplir le tableau de chunks
          setChunks(Array.from({ length: event.chunkCount }, (_, i) => ({
            index: i,
            url: null,
            text: '',
            duration: 0,
            status: 'pending'
          })))
          break

        case 'progress':
          setChunkCurrent(event.current)
          break

        case 'chunk':
          setChunks(prev => {
            const next = [...prev]
            if (next[event.index]) {
              next[event.index] = {
                ...next[event.index],
                url: event.url,
                text: event.text || '',
                duration: event.duration || 0,
                status: 'generated'
              }
            }
            return next
          })
          setTotalGenerated(prev => prev + 1)

          // Auto-play : si rien ne joue encore, ou si on attendait le chunk suivant
          setCurrentPlayIdx(prev => {
            if (prev === -1) return event.index
            // Si on attendait le chunk suivant (le précédent est fini)
            if (waitingForNextRef.current) {
              waitingForNextRef.current = false
              return event.index
            }
            return prev
          })
          break

        case 'chunk_error':
          setChunks(prev => {
            const next = [...prev]
            if (next[event.index]) {
              next[event.index] = { ...next[event.index], status: 'error' }
            }
            return next
          })
          break

        case 'done':
          setMergeUrl(event.mergeUrl)
          setTotalGenerated(event.generatedCount || event.chunkCount)
          setStatus('playing')
          break

        case 'error':
          setErrorMsg(event.message)
          setStatus('error')
          break
      }
    })

    cancelRef.current = cancel
  }, [text, mode, chunkSize, format, speed, status])

  const stopGeneration = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current()
      cancelRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setStatus('idle')
  }, [])

  // ─── Lecture séquentielle ────────────────────────────────────────────────

  // Quand currentPlayIdx change, jouer ce chunk
  useEffect(() => {
    if (currentPlayIdx < 0) return
    const chunk = chunks[currentPlayIdx]
    if (!chunk || !chunk.url || chunk.status === 'error') {
      // Passer au suivant
      const next = chunks.findIndex((c, i) => i > currentPlayIdx && c.url && c.status !== 'error')
      if (next >= 0) setCurrentPlayIdx(next)
      return
    }

    // Marquer comme "playing"
    setChunks(prev => {
      const next = [...prev]
      next[currentPlayIdx] = { ...next[currentPlayIdx], status: 'playing' }
      return next
    })

    if (audioRef.current) {
      audioRef.current.src = chunk.url
      audioRef.current.play().catch(() => {
        // Autoplay bloqué — l'utilisateur devra cliquer play
        setStatus('paused')
      })
    }

    setStatus('playing')
  }, [currentPlayIdx])

  const onAudioEnded = useCallback(() => {
    // Marquer comme "played"
    setChunks(prev => {
      const next = [...prev]
      if (next[currentPlayIdx]) {
        next[currentPlayIdx] = { ...next[currentPlayIdx], status: 'played' }
      }
      return next
    })

    // Passer au chunk suivant
    const next = chunks.findIndex((c, i) => i > currentPlayIdx && c.url && c.status !== 'error')
    if (next >= 0) {
      setCurrentPlayIdx(next)
    } else if (totalGenerated >= chunkTotal && currentPlayIdx >= chunkTotal - 1) {
      // Tout est joué
      setStatus('done')
    } else {
      // En attente du prochain chunk à générer
      waitingForNextRef.current = true
    }
  }, [currentPlayIdx, chunks, totalGenerated, chunkTotal])

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return
    if (status === 'playing') {
      audioRef.current.pause()
      setStatus('paused')
    } else if (status === 'paused') {
      audioRef.current.play().catch(() => {})
      setStatus('playing')
    }
  }, [status])

  const skipChunk = useCallback((dir) => {
    const nextIdx = currentPlayIdx + dir
    if (nextIdx >= 0 && nextIdx < chunkTotal) {
      const target = chunks[nextIdx]
      if (target && target.url && target.status !== 'error') {
        setCurrentPlayIdx(nextIdx)
      } else {
        // Chercher le prochain chunk valide
        const valid = chunks.findIndex((c, i) => {
          if (dir > 0) return i > currentPlayIdx && c.url && c.status !== 'error'
          return i < currentPlayIdx && c.url && c.status !== 'error'
        })
        if (valid >= 0) setCurrentPlayIdx(valid)
      }
    }
  }, [currentPlayIdx, chunkTotal, chunks])

  // ─── Réinitialisation ────────────────────────────────────────────────────

  const resetAll = useCallback(() => {
    stopGeneration()
    setChunks([])
    setChunkCurrent(0)
    setChunkTotal(0)
    setCurrentPlayIdx(-1)
    setTotalGenerated(0)
    setMergeUrl(null)
    setSessionId(null)
    setErrorMsg(null)
    setStatus('idle')
  }, [stopGeneration])

  // ─── Rendu ───────────────────────────────────────────────────────────────

  const progressPct = chunkTotal > 0 ? Math.round((totalGenerated / chunkTotal) * 100) : 0

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">🎙️ Vocal TTS</h1>
      <p className="text-sm text-gray-500 -mt-2">
        Convertissez un texte en audio via Piper TTS. Le texte est découpé en segments lus
        séquentiellement pour un effet streaming.
      </p>

      {/* ── Zone de texte ─────────────────────────────────────────────── */}
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

      {/* ── Paramètres ────────────────────────────────────────────────── */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Paramètres de génération</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Mode */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Découpage</label>
            <select
              className={inputCls}
              value={mode}
              onChange={e => {
                setMode(e.target.value)
                setChunkSize(e.target.value === 'sentences' ? 3 : 100)
              }}
              disabled={status === 'generating'}
            >
              <option value="sentences">Par phrases</option>
              <option value="words">Par mots</option>
            </select>
          </div>

          {/* Taille */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {mode === 'sentences' ? 'Phrases / segment' : 'Mots / segment'}
            </label>
            <input
              type="number"
              className={inputCls}
              value={chunkSize}
              onChange={e => setChunkSize(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={mode === 'sentences' ? 20 : 500}
              disabled={status === 'generating'}
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Format audio</label>
            <select
              className={inputCls}
              value={format}
              onChange={e => setFormat(e.target.value)}
              disabled={status === 'generating'}
            >
              <option value="wav">WAV (qualité max)</option>
              <option value="mp3">MP3 (compressé)</option>
            </select>
          </div>

          {/* Vitesse */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Vitesse : {speed.toFixed(1)}x
            </label>
            <input
              type="range"
              className="w-full"
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              min={0.5}
              max={2.0}
              step={0.1}
              disabled={status === 'generating'}
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>0.5x</span><span>1.0x</span><span>2.0x</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Boutons d'action ──────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {status === 'idle' || status === 'done' || status === 'error' ? (
          <button
            className={btnCls}
            onClick={startGeneration}
            disabled={!text.trim()}
          >
            🎬 Générer l'audio
          </button>
        ) : (
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700" onClick={stopGeneration}>
            ⏹️ Arrêter
          </button>
        )}

        {(status === 'playing' || status === 'paused') && (
          <button className={btnSecondary} onClick={togglePlayPause}>
            {status === 'playing' ? '⏸️ Pause' : '▶️ Reprendre'}
          </button>
        )}

        {status !== 'idle' && (
          <button className={btnSecondary} onClick={resetAll}>
            🔄 Nouveau texte
          </button>
        )}

        {mergeUrl && status === 'done' && (
          <a
            href={mergeUrl}
            className={btnCls + ' !bg-green-600 hover:!bg-green-700 inline-flex items-center gap-1'}
            download
          >
            📥 Télécharger tout ({format.toUpperCase()})
          </a>
        )}
      </div>

      {/* ── Barre de progression ──────────────────────────────────────── */}
      {(status !== 'idle' || chunkTotal > 0) && (
        <div className={cardCls}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">
              {status === 'generating' && `Génération… ${totalGenerated}/${chunkTotal} segments`}
              {status === 'playing' && `Lecture… ${currentPlayIdx + 1}/${chunkTotal}`}
              {status === 'paused' && `Pause — ${currentPlayIdx + 1}/${chunkTotal}`}
              {status === 'done' && `✅ Terminé — ${chunkTotal} segments`}
              {status === 'error' && '⚠️ Erreur'}
            </span>
            <span className="text-gray-400">{progressPct}%</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                status === 'error' ? 'bg-red-500' :
                status === 'done' ? 'bg-green-500' :
                'bg-indigo-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {estimatedMin > 0 && (
            <p className="text-xs text-gray-400">
              ~{estimatedMin} min d'audio • ~{Math.ceil(estimatedMin / 3)} min de génération estimées
            </p>
          )}
        </div>
      )}

      {/* ── Erreur ────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* ── Lecteur & suivi des chunks ────────────────────────────────── */}
      {chunks.length > 0 && (
        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Segments</h2>

          {/* Lecteur audio caché */}
          <audio
            ref={audioRef}
            onEnded={onAudioEnded}
            onError={() => {
              // Erreur de lecture — passer au suivant
              onAudioEnded()
            }}
            className="hidden"
          />

          {/* Contrôles lecture */}
          {(status === 'playing' || status === 'paused' || status === 'done') && (
            <div className="flex items-center gap-2 mb-3">
              <button className={btnSecondary} onClick={() => skipChunk(-1)} disabled={currentPlayIdx <= 0} title="Précédent">
                ⏮
              </button>
              <button className={btnCls} onClick={togglePlayPause}>
                {status === 'playing' ? '⏸️' : '▶️'}
              </button>
              <button className={btnSecondary} onClick={() => skipChunk(1)} disabled={currentPlayIdx >= chunkTotal - 1} title="Suivant">
                ⏭
              </button>
              <span className="text-xs text-gray-500 ml-2">
                Segment {currentPlayIdx + 1}/{chunkTotal}
                {chunks[currentPlayIdx]?.duration > 0 && ` — ${chunks[currentPlayIdx].duration}s`}
              </span>
            </div>
          )}

          {/* Liste des chunks avec surbrillance du chunk actif */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {chunks.map((chunk, i) => {
              const isCurrent = i === currentPlayIdx
              const bg = isCurrent && status === 'playing'
                ? 'bg-indigo-50 border-indigo-300'
                : chunk.status === 'played'
                  ? 'bg-gray-50 border-gray-200'
                  : chunk.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : chunk.status === 'generated'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-100'

              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${bg} ${
                    isCurrent ? 'ring-2 ring-indigo-300' : ''
                  }`}
                  onClick={() => {
                    if (chunk.url && chunk.status !== 'error') {
                      setCurrentPlayIdx(i)
                      if (audioRef.current) {
                        audioRef.current.src = chunk.url
                        audioRef.current.play().catch(() => {})
                        setStatus('playing')
                      }
                    }
                  }}
                >
                  <span className="text-gray-400 w-6 text-right flex-shrink-0">{i + 1}</span>
                  <span className={`flex-shrink-0 w-5 text-center ${
                    chunk.status === 'generated' || chunk.status === 'played' || chunk.status === 'playing'
                      ? 'text-green-600' : chunk.status === 'error' ? 'text-red-500' : 'text-gray-300'
                  }`}>
                    {chunk.status === 'playing' ? '🔊' :
                     chunk.status === 'played' ? '✅' :
                     chunk.status === 'generated' ? '🎵' :
                     chunk.status === 'error' ? '❌' : '⏳'}
                  </span>
                  <span className={`flex-1 truncate ${
                    isCurrent ? 'text-indigo-800 font-medium' : 'text-gray-600'
                  }`}>
                    {chunk.text || (chunk.status === 'pending' ? 'En attente…' : '...')}
                  </span>
                  {chunk.duration > 0 && (
                    <span className="text-gray-400 flex-shrink-0">{chunk.duration}s</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
