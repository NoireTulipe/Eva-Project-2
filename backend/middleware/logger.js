import { logAction, logError } from '../logs/logger.js'

export function loggerMiddleware(req, res, next) {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const message = `${req.method} ${req.originalUrl} — ${res.statusCode} (${duration}ms)`

    if (res.statusCode >= 500) {
      logError(message)
    } else {
      logAction(message)
    }
  })

  next()
}