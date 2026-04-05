import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getDbPath() {
  const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'
  const rel = url.startsWith('file:') ? url.slice(5) : './prisma/dev.db'
  return resolve(__dirname, '..', rel)
}

export async function backupDatabase() {
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) throw new Error(`Base introuvable : ${dbPath}`)

  const [pathParam, keepParam] = await Promise.all([
    prisma.configParam.findUnique({ where: { cle: 'backup.path' } }),
    prisma.configParam.findUnique({ where: { cle: 'backup.keep' } })
  ])

  const destDir = resolve(__dirname, '..', pathParam?.valeur || './prisma/')
  const keepN = Math.max(1, parseInt(keepParam?.valeur || '10', 10))

  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })

  // Créer la sauvegarde horodatée
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const fichier = `backup-${ts}.db`
  copyFileSync(dbPath, resolve(destDir, fichier))
  logAction(`Backup: "${fichier}" créé`)

  // Rotation : ne garder que les N plus récentes
  const backups = readdirSync(destDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
    .map(f => ({ nom: f, mtime: statSync(resolve(destDir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime)

  const aSupprimer = backups.slice(keepN)
  for (const b of aSupprimer) {
    unlinkSync(resolve(destDir, b.nom))
    logAction(`Backup: rotation — "${b.nom}" supprimé`)
  }

  logAction(`Backup: ${Math.min(backups.length, keepN)}/${keepN} sauvegarde(s) conservée(s)`)
}
