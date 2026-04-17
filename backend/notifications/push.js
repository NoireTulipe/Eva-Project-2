import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { logError } from '../logs/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let messaging = null

async function getMessaging() {
  if (messaging) return messaging
  try {
    const { default: admin } = await import('firebase-admin')
    if (!admin.apps.length) {
      const saPath = resolve(__dirname, '../', process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'))
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    }
    messaging = admin.messaging()
  } catch (err) {
    logError(`Firebase init échouée : ${err.message}`)
    throw err
  }
  return messaging
}

/**
 * Envoie une notification à un ou plusieurs tokens FCM.
 * @param {string|string[]} tokens
 * @param {{ title: string, body: string, data?: Record<string,string> }} payload
 */
export async function sendPush(tokens, { title, body, data = {} }) {
  const liste = Array.isArray(tokens) ? tokens : [tokens]
  if (!liste.length) return

  try {
    const msg = await getMessaging()
    const res = await msg.sendEachForMulticast({
      tokens: liste,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'eva_default' },
      },
    })
    if (res.failureCount > 0) {
      res.responses.forEach((r, i) => {
        if (!r.success) logError(`Push token[${i}] échoué : ${r.error?.message}`)
      })
    }
    return res
  } catch (err) {
    logError(`sendPush : ${err.message}`)
    throw err
  }
}

/**
 * Récupère tous les tokens FCM d'un utilisateur.
 */
export async function getTokensForUser(userId, prisma) {
  const rows = await prisma.deviceToken.findMany({ where: { userId } })
  return rows.map(r => r.token)
}

/**
 * Récupère tous les tokens FCM de tous les utilisateurs actifs.
 */
export async function getAllTokens(prisma) {
  const rows = await prisma.deviceToken.findMany({ include: { user: { select: { actif: true } } } })
  return rows.filter(r => r.user.actif).map(r => r.token)
}
