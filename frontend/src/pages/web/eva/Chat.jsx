import { useState, useRef, useEffect } from 'react'
import { eva, conversations as convsApi } from '../../../shared/api.js'

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
  const [convList, setConvList] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)
  const [thinkingPhrase, setThinkingPhrase] = useState('')
  const [renaming, setRenaming] = useState(null) // id de la conv en cours de renommage
  const [renameValue, setRenameValue] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef = useRef(null)
  const phraseIntervalRef = useRef(null)
  const renameInputRef = useRef(null)

  // Charger la liste des conversations au montage
  useEffect(() => {
    loadConvList()
  }, [])

  async function loadConvList() {
    try {
      const list = await convsApi.getAll()
      setConvList(list)
    } catch (err) {
      console.error('loadConvList:', err)
    }
  }

  // Charger une conversation
  async function openConversation(id) {
    if (id === activeConvId) return
    setLoadingConv(true)
    try {
      const conv = await convsApi.getById(id)
      setActiveConvId(id)
      setMessages(conv.messages.map(m => ({ role: m.role, content: m.content, id: m.id })))
    } catch (err) {
      console.error('openConversation:', err)
    } finally {
      setLoadingConv(false)
    }
  }

  // Nouvelle conversation
  async function newConversation() {
    try {
      const conv = await convsApi.create('Nouvelle conversation')
      setConvList(prev => [conv, ...prev])
      setActiveConvId(conv.id)
      setMessages([])
    } catch (err) {
      console.error('newConversation:', err)
    }
  }

  // Supprimer une conversation
  async function deleteConversation(id, e) {
    e.stopPropagation()
    if (!confirm('Supprimer cette conversation ?')) return
    try {
      await convsApi.remove(id)
      setConvList(prev => prev.filter(c => c.id !== id))
      if (activeConvId === id) {
        setActiveConvId(null)
        setMessages([])
      }
    } catch {
      // silencieux
    }
  }

  // Renommer
  function startRename(conv, e) {
    e.stopPropagation()
    setRenaming(conv.id)
    setRenameValue(conv.titre)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  async function submitRename(id) {
    if (!renameValue.trim()) { setRenaming(null); return }
    try {
      const updated = await convsApi.rename(id, renameValue.trim())
      setConvList(prev => prev.map(c => c.id === id ? { ...c, titre: updated.titre } : c))
    } catch {
      // silencieux
    } finally {
      setRenaming(null)
    }
  }

  // Scroll auto
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Rotation des phrases "je réfléchis"
  useEffect(() => {
    if (loading) {
      setThinkingPhrase(getRandomPhrase())
      phraseIntervalRef.current = setInterval(() => setThinkingPhrase(getRandomPhrase()), 2500)
    } else {
      clearInterval(phraseIntervalRef.current)
    }
    return () => clearInterval(phraseIntervalRef.current)
  }, [loading])

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    // Créer une conversation si aucune n'est active
    let convId = activeConvId
    if (!convId) {
      try {
        const conv = await convsApi.create('Nouvelle conversation')
        convId = conv.id
        setActiveConvId(convId)
        setConvList(prev => [conv, ...prev])
      } catch (err) {
        console.warn('Création conversation échouée, mode éphémère:', err)
      }
    }

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    try {
      const { response, conversationId } = await eva.chat(text, convId)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])

      // Mettre à jour le titre si la conv vient d'être créée
      if (conversationId) {
        setConvList(prev => prev.map(c =>
          c.id === conversationId
            ? { ...c, updatedAt: new Date().toISOString() }
            : c
        ))
        // Recharger la liste pour récupérer le titre auto-généré
        setTimeout(loadConvList, 500)
      }
    } catch {
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
    if (e.key === 'Enter' && !e.shiftKey) handleSend(e)
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 86400000) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 120px)' }}>

      {/* Sidebar conversations */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-200 overflow-hidden flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col`}>
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Nouvelle conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convList.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">Aucune conversation</p>
          )}
          {convList.map(conv => (
            <div
              key={conv.id}
              onClick={() => openConversation(conv.id)}
              className={`group flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${activeConvId === conv.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}
            >
              {renaming === conv.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(conv.id)}
                  onKeyDown={e => { if (e.key === 'Enter') submitRename(conv.id); if (e.key === 'Escape') setRenaming(null) }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 text-xs border border-indigo-300 rounded px-1 py-0.5 focus:outline-none"
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{conv.titre}</p>
                  <p className="text-xs text-gray-400">{formatDate(conv.updatedAt)}</p>
                </div>
              )}
              <div className="flex-shrink-0 hidden group-hover:flex gap-0.5">
                <button
                  onClick={e => startRename(conv, e)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Renommer"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={e => deleteConversation(conv.id, e)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                  title="Supprimer"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Barre de titre */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
            title={sidebarOpen ? 'Masquer les conversations' : 'Afficher les conversations'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm text-gray-500">
            {activeConvId
              ? (convList.find(c => c.id === activeConvId)?.titre ?? 'Conversation')
              : 'EVA — Nouvelle conversation'}
          </span>
        </div>

        {/* Zone de messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loadingConv && (
            <div className="flex justify-center pt-8">
              <div className="text-gray-400 text-sm">Chargement...</div>
            </div>
          )}

          {!loadingConv && messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-lg font-medium text-gray-500">Bonjour, je suis EVA</p>
                <p className="text-sm mt-1">Pose-moi une question ou demande-moi quelque chose.</p>
              </div>
            </div>
          )}

          {!loadingConv && messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 flex-shrink-0">
                  E
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : msg.error
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

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
        <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0">
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
    </div>
  )
}
