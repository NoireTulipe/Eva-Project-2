import { useState, useRef, useEffect } from 'react'
import { eva } from '../../../shared/api.js'

const THINKING_PHRASES = [
  'Je réfléchis à ça...',
  'Laisse-moi voir ça en détail...',
  'Deux secondes, j\'analyse...',
  'Je cherche dans mes données...',
  'Un instant...',
  'Voyons ce que je peux faire...',
  'Je consulte ça pour toi...',
  'Analyse en cours...',
  'Je me penche sur la question...',
  'Bonne question, je cherche...',
  'Je fouille tout ça...',
  'Attends, je vérifie...',
]

function getRandomPhrase() {
  return THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]
}

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingPhrase, setThinkingPhrase] = useState('')
  const bottomRef = useRef(null)
  const phraseIntervalRef = useRef(null)

  // Scroll automatique vers le bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Rotation des phrases "je réfléchis"
  useEffect(() => {
    if (loading) {
      setThinkingPhrase(getRandomPhrase())
      phraseIntervalRef.current = setInterval(() => {
        setThinkingPhrase(getRandomPhrase())
      }, 2500)
    } else {
      clearInterval(phraseIntervalRef.current)
    }
    return () => clearInterval(phraseIntervalRef.current)
  }, [loading])

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]

    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      // On envoie les 10 derniers messages comme historique (hors le message courant)
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const { response } = await eva.chat(text, history)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Désolée, j\'ai eu un souci technique. Réessaie dans un instant.',
        error: true
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend(e)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 120px)' }}>

      {/* Zone de messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-lg font-medium text-gray-500">Bonjour, je suis EVA</p>
              <p className="text-sm mt-1">Pose-moi une question ou demande-moi quelque chose.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 flex-shrink-0">
                E
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : msg.error
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Bulle "EVA réfléchit" */}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 flex-shrink-0">
              E
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-500 italic shadow-sm">
              {thinkingPhrase}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <form onSubmit={handleSend} className="flex gap-2">
          <textarea
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={2}
            placeholder="Écris ton message… (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
          >
            Envoyer
          </button>
        </form>
      </div>

    </div>
  )
}
