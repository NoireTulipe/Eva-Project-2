/**
 * instagram.renderer.js — Rendu serveur d'une vignette Instafacile en PNG
 *
 * Reconstruit le canvas depuis le JSON Konva d'un IgPost template en utilisant
 * node-canvas. Génère un PNG 1080px (ou selon format) côté serveur, sans browser.
 *
 * Prérequis : npm install canvas --workspace=backend
 */

import { createCanvas, loadImage } from 'canvas'
import { resolve, dirname }        from 'path'
import { fileURLToPath }           from 'url'
import { writeFile, mkdir }        from 'fs/promises'
import { existsSync }              from 'fs'
import { IG_FORMATS_SERVER }       from './igFormats.server.js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../uploads/instagram/generated')
const UPLOADS    = resolve(__dirname, '../../uploads/instagram')

// ── Rendu d'une vignette (slide) ──────────────────────────────────────────────

async function renderSlide(slideData, width, height) {
  const canvas = createCanvas(width, height)
  const ctx    = canvas.getContext('2d')

  // 1. Fond
  const bg = slideData.background
  if (bg?.type === 'color' || !bg?.type) {
    ctx.fillStyle = bg?.value ?? '#ffffff'
    ctx.fillRect(0, 0, width, height)
  } else if (bg?.type === 'image' && bg?.value) {
    try {
      const imgPath = resolve(UPLOADS, 'backgrounds', bg.value)
      if (existsSync(imgPath)) {
        const img = await loadImage(imgPath)
        // Couvre tout le canvas (object-fit: cover)
        const scale = Math.max(width / img.width, height / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        ctx.drawImage(img, (width - sw) / 2, (height - sh) / 2, sw, sh)
      }
    } catch {}
  }

  // 2. Éléments (textes + images — les shapes complexes sont ignorées pour l'instant)
  const elements = (slideData.elements ?? [])
    .filter(e => e.visible !== false)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

  for (const el of elements) {
    ctx.save()

    // Transformation (position, rotation, scale)
    const cx = (el.x ?? 0) + (el.width ?? 0) / 2
    const cy = (el.y ?? 0) + (el.height ?? 0) / 2
    ctx.translate(cx, cy)
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180)
    const scaleX = el.scaleX ?? 1
    const scaleY = el.scaleY ?? 1
    ctx.scale(scaleX, scaleY)
    ctx.translate(-cx, -cy)

    if (el.type === 'text') {
      const fontSize  = el.fontSize ?? 24
      const fontFamily = el.fontFamily ?? 'sans-serif'
      const bold      = el.fontStyle?.includes('bold') ? 'bold ' : ''
      const italic    = el.fontStyle?.includes('italic') ? 'italic ' : ''
      ctx.font        = `${italic}${bold}${fontSize}px "${fontFamily}", sans-serif`
      ctx.fillStyle   = el.fill ?? '#000000'
      ctx.globalAlpha = el.opacity ?? 1
      ctx.textAlign   = el.align ?? 'left'

      // Découpage du texte en lignes
      const text  = el.text ?? ''
      const lines = text.split('\n')
      const lineH = fontSize * (el.lineHeight ?? 1.2)
      const x     = el.x ?? 0
      const y     = (el.y ?? 0) + fontSize

      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + i * lineH, el.width ?? width)
      })

    } else if (el.type === 'image' && el.src) {
      try {
        const img = await loadImage(el.src.startsWith('http') ? el.src : resolve(UPLOADS, el.src))
        ctx.globalAlpha = el.opacity ?? 1
        ctx.drawImage(img, el.x ?? 0, el.y ?? 0, el.width ?? 100, el.height ?? 100)
      } catch {}
    }

    ctx.restore()
  }

  return canvas
}

// ── Export public ─────────────────────────────────────────────────────────────

/**
 * Génère le PNG de la 1ère vignette d'un IgPost et le sauvegarde sur le disque.
 * Retourne le chemin relatif du fichier généré.
 */
export async function renderPostToPng(post) {
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true })

  const slides    = JSON.parse(post.vignettes ?? '[]')
  const slide     = slides[0]
  if (!slide) throw new Error('Aucune vignette dans ce post')

  const fmt       = IG_FORMATS_SERVER[post.format] ?? IG_FORMATS_SERVER.portrait
  const canvas    = await renderSlide(slide, fmt.exportW, fmt.exportH)
  const filename  = `planif-${post.id}-${Date.now()}.png`
  const filepath  = resolve(OUTPUT_DIR, filename)

  await writeFile(filepath, canvas.toBuffer('image/png'))
  return `generated/${filename}`
}
