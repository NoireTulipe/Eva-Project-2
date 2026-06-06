/**
 * audio-cleanup.cron.js — Nettoyage quotidien du cache audio TTS
 *
 * Cron : tous les jours à 3h00 du matin.
 * Supprime les fichiers .wav / .mp3 / .txt plus vieux que vocal.retention_days
 * (7 jours par défaut).
 */

import cron from 'node-cron'
import { cleanupOldFiles } from '../modules/vocal/tts.service.js'
import { logAction, logError } from '../logs/logger.js'

let _task = null

export function startAudioCleanupCron() {
  if (_task) return _task

  _task = cron.schedule('7 3 * * *', async () => {
    try {
      const deleted = await cleanupOldFiles()
      if (deleted > 0) {
        logAction(`Audio cache : ${deleted} fichier(s) nettoyé(s)`)
      }
    } catch (err) {
      logError(`Audio cache cleanup : ${err.message}`)
    }
  })

  logAction('Cron audio-cleanup : programmé (3h07 chaque jour)')
  return _task
}
