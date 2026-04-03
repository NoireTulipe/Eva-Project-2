import { createContext, useContext, useState, useEffect } from 'react'
import { sessions as sessionsApi } from './api.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('session')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  // Vérifier au démarrage que la session stockée est encore ouverte
  // Si aucune session locale, chercher une session ouverte sur le serveur
  useEffect(() => {
    async function verifier() {
      try {
        if (session?.id) {
          // Session en mémoire → vérifier qu'elle est toujours ouverte
          const s = await sessionsApi.getById(session.id)
          if (s.statut !== 'ouverte') {
            localStorage.removeItem('session')
            setSession(null)
          } else {
            const updated = { id: s.id, pdvNom: s.pointDeVente?.nom, debut: s.debut }
            setSession(updated)
            localStorage.setItem('session', JSON.stringify(updated))
          }
        } else {
          // Pas de session locale → chercher une session ouverte sur le serveur
          const liste = await sessionsApi.getAll({ limit: 20 })
          const active = liste?.find(s => s.statut === 'ouverte')
          if (active) {
            const updated = { id: active.id, pdvNom: active.pointDeVente?.nom, debut: active.debut }
            setSession(updated)
            localStorage.setItem('session', JSON.stringify(updated))
          }
        }
      } catch {
        // Non authentifié ou erreur réseau → ignorer, on restera sur l'écran login/ouverture
      } finally {
        setLoading(false)
      }
    }
    verifier()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function ouvrirSession(s) {
    const data = { id: s.id, pdvNom: s.pointDeVente?.nom, debut: s.debut }
    setSession(data)
    localStorage.setItem('session', JSON.stringify(data))
  }

  function fermerSession() {
    setSession(null)
    localStorage.removeItem('session')
  }

  return (
    <SessionContext.Provider value={{ session, loading, ouvrirSession, fermerSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
