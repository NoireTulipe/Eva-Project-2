import cron from 'node-cron'
import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'
import { consolidateAll } from '../modules/memoire/consolidation.js'

// Registre des tâches actives { nom → task }
const activeTasks = new Map()

// Catalogue des handlers disponibles
const HANDLERS = {
  'memoire.consolidation': consolidateAll
}

/**
 * Démarre toutes les crons actives depuis la base.
 */
export async function startAllCrons() {
  const configs = await prisma.cronConfig.findMany({ where: { actif: true } })

  for (const config of configs) {
    startCron(config)
  }

  logAction(`Crons : ${configs.length} tâche(s) démarrée(s)`)
}

/**
 * Démarre une tâche cron.
 */
export function startCron(config) {
  if (activeTasks.has(config.nom)) {
    activeTasks.get(config.nom).stop()
  }

  const handler = HANDLERS[config.nom]
  if (!handler) {
    logError(`Cron "${config.nom}" : handler introuvable`)
    return
  }

  if (!cron.validate(config.expression)) {
    logError(`Cron "${config.nom}" : expression invalide — ${config.expression}`)
    return
  }

  const task = cron.schedule(config.expression, async () => {
    logAction(`Cron "${config.nom}" : déclenchement`)
    try {
      await handler()
      logAction(`Cron "${config.nom}" : terminé`)
    } catch (err) {
      logError(`Cron "${config.nom}" : erreur — ${err.message}`)
    }
  })

  activeTasks.set(config.nom, task)
  logAction(`Cron "${config.nom}" planifié : ${config.expression}`)
}

/**
 * Arrête une tâche cron.
 */
export function stopCron(nom) {
  if (activeTasks.has(nom)) {
    activeTasks.get(nom).stop()
    activeTasks.delete(nom)
    logAction(`Cron "${nom}" arrêté`)
  }
}

/**
 * Exécute une tâche immédiatement (déclenchement manuel).
 */
export async function runCronNow(nom) {
  const handler = HANDLERS[nom]
  if (!handler) throw new Error(`Handler introuvable pour "${nom}"`)
  logAction(`Cron "${nom}" : exécution manuelle`)
  await handler()
  logAction(`Cron "${nom}" : terminé`)
}

/**
 * Retourne les noms des crons actifs en mémoire.
 */
export function getActiveCrons() {
  return [...activeTasks.keys()]
}
