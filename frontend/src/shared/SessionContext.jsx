import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { sessions, auth } from './api.js'

const SessionContext = createContext(null)

const STORAGE_KEY = 'eva_session_active_id'

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)

  // Au montage : chercher une session ouverte
  // 1. Si un ID est en localStorage, le vérifier en priorité
  // 2. Sinon, interroger le backend pour détecter une session ouverte existante
  useEffect(() => {
    async function detecterSession() {
      if (!auth.isLoggedIn()) {
        setLoadingSession(false)
        return
      }
      const savedId = localStorage.getItem(STORAGE_KEY)

      if (savedId) {
        try {
          const s = await sessions.getById(Number(savedId))
          if (s && s.statut === 'ouverte') {
            setSession(s)
            return
          }
        } catch {
          // ignoré
        }
        localStorage.removeItem(STORAGE_KEY)
      }

      // Pas d'ID local — chercher dans les sessions récentes
      try {
        const liste = await sessions.getAll({ limit: 5 })
        const ouverte = liste.find(s => s.statut === 'ouverte')
        if (ouverte) {
          localStorage.setItem(STORAGE_KEY, String(ouverte.id))
          setSession(ouverte)
        }
      } catch {
        // pas de session détectée, on continue sans
      }
    }

    detecterSession().finally(() => setLoadingSession(false))
  }, [])

  const ouvrirSession = useCallback(async (pointDeVenteId, debut) => {
    const s = await sessions.open(pointDeVenteId, debut)
    const detail = await sessions.getById(s.id)
    localStorage.setItem(STORAGE_KEY, String(detail.id))
    setSession(detail)
    return detail
  }, [])

  const rechargerSession = useCallback(async () => {
    if (!session) return
    const detail = await sessions.getById(session.id)
    setSession(detail)
    return detail
  }, [session])

  const cloturerSession = useCallback(async () => {
    if (!session) return
    const recap = await sessions.cloturer(session.id)
    localStorage.removeItem(STORAGE_KEY)
    const detail = await sessions.getById(session.id)
    setSession(null)
    return { recap, session: detail }
  }, [session])

  return (
    <SessionContext.Provider value={{ session, loadingSession, ouvrirSession, rechargerSession, cloturerSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
