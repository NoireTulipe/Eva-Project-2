import { createContext, useContext, useState, useEffect } from 'react'
import { sessions as sessionsApi } from './api.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('session')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  // Vérifier au démarrage que la session stockée est encore ouverte
  useEffect(() => {
    async function verifier() {
      if (!session?.id) { setLoading(false); return }
      try {
        const s = await sessionsApi.getById(session.id)
        if (s.cloture) {
          localStorage.removeItem('session')
          setSession(null)
        } else {
          // Rafraîchir les données
          const updated = { id: s.id, pdvNom: s.pointDeVente?.nom, debut: s.debut }
          setSession(updated)
          localStorage.setItem('session', JSON.stringify(updated))
        }
      } catch {
        // En cas d'erreur réseau : on garde la session locale
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
