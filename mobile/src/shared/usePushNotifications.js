import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { notifications as notifApi } from './api.js'

export function usePushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cleanup = () => {}

    async function init() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        const permResult = await PushNotifications.requestPermissions()
        if (permResult.receive !== 'granted') return

        await PushNotifications.register()

        const regHandler = await PushNotifications.addListener('registration', async ({ value: token }) => {
          try { await notifApi.enregistrerToken(token) } catch {}
        })

        // Notification reçue en foreground → log silencieux (pas de popup native)
        const rcvHandler = await PushNotifications.addListener('pushNotificationReceived', (notif) => {
          console.log('[Push] Reçue en foreground:', notif.title)
        })

        // Tap sur une notification → navigation possible ici plus tard
        const actHandler = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[Push] Action:', action.actionId, action.notification.data)
        })

        cleanup = () => {
          regHandler.remove()
          rcvHandler.remove()
          actHandler.remove()
        }
      } catch (err) {
        console.warn('[Push] Init échouée:', err.message)
      }
    }

    init()
    return () => cleanup()
  }, [])
}
