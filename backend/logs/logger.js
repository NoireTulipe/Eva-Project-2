import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const errorLog = path.join(__dirname, 'errors.log')
const actionLog = path.join(__dirname, 'actions.log')

function timestamp() {
  return new Date().toISOString()
}

function write(file, message) {
  const line = `[${timestamp()}] ${message}\n`
  fs.appendFileSync(file, line, 'utf8')
}

export function logError(message) {
  console.error(`[ERROR] ${message}`)
  write(errorLog, `ERROR — ${message}`)
}

export function logAction(message) {
  console.log(`[ACTION] ${message}`)
  write(actionLog, `ACTION — ${message}`)
}