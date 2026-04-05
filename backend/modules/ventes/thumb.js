import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, unlinkSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = resolve(__dirname, '../../uploads/produits')
const THUMBS_DIR  = resolve(__dirname, '../../uploads/thumbs')
mkdirSync(THUMBS_DIR, { recursive: true })

// Le thumb est toujours stocké en .jpg (jpeg optimisé), quelle que soit l'extension source
function thumbPath(srcFilename) {
  const base = srcFilename.replace(/\.[^.]+$/, '')
  return resolve(THUMBS_DIR, `${base}.jpg`)
}

// Génère le thumb d'un fichier source (appelé à l'upload)
export async function generateThumb(srcFilename) {
  const src = resolve(UPLOADS_DIR, srcFilename)
  if (!existsSync(src)) throw new Error(`Source introuvable : ${srcFilename}`)
  await sharp(src)
    .resize(300, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbPath(srcFilename))
}

// Supprime le thumb associé à un fichier source (appelé à la suppression)
export function deleteThumb(srcFilename) {
  const dst = thumbPath(srcFilename)
  if (existsSync(dst)) unlinkSync(dst)
}

// Middleware Express : GET /uploads/thumb/:filename
// Le client demande toujours une URL en .jpg
export async function thumbMiddleware(req, res) {
  const { filename } = req.params
  // Sécurité : pas de path traversal
  if (filename.includes('/') || filename.includes('..')) return res.status(400).end()

  const dst = thumbPath(filename)

  if (!existsSync(dst)) {
    // Chercher la source quelle que soit son extension
    const base = filename.replace(/\.[^.]+$/, '')
    const exts = ['.jpg', '.jpeg', '.png', '.webp']
    let src = null
    for (const ext of exts) {
      const candidate = resolve(UPLOADS_DIR, `${base}${ext}`)
      if (existsSync(candidate)) { src = candidate; break }
    }
    if (!src) return res.status(404).end()

    try {
      await sharp(src)
        .resize(300, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(dst)
    } catch {
      // Fallback : on sert l'original si sharp échoue
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.sendFile(src)
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable') // 30 jours
  res.sendFile(dst)
}
