/**
 * instagram.renderer.js — Rendu serveur d'une vignette Instafacile en PNG
 *
 * Les coordonnées Konva sont en espace "display" (540px de large).
 * On applique un scale (exportW / displayW = 2) pour obtenir 1080px.
 */

import { createCanvas, loadImage, registerFont } from 'canvas'
import { resolve, dirname }        from 'path'
import { fileURLToPath }           from 'url'
import { writeFile, mkdir }        from 'fs/promises'
import { existsSync }              from 'fs'
import { IG_FORMATS_SERVER }       from './igFormats.server.js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../../uploads/instagram/generated')
const UPLOADS    = resolve(__dirname, '../../uploads/instagram')

// Largeur d'affichage de référence (identique à igFormats.js côté front)
const DISPLAY_W = 540

// ── Rendu d'une vignette ──────────────────────────────────────────────────────

async function renderSlide(slideData, exportW, exportH) {
  const scale  = exportW / DISPLAY_W   // = 2 pour tous les formats
  const canvas = createCanvas(exportW, exportH)
  const ctx    = canvas.getContext('2d')

  // 1. Fond
  const bg = slideData.background
  if (bg?.type === 'color' || !bg?.type) {
    ctx.fillStyle = bg?.value ?? '#ffffff'
    ctx.fillRect(0, 0, exportW, exportH)
  } else if (bg?.type === 'image' && bg?.value) {
    try {
      // bg.value peut être une URL data: ou un chemin relatif
      const src = bg.value.startsWith('data:') || bg.value.startsWith('http')
        ? bg.value
        : resolve(UPLOADS, 'backgrounds', bg.value)
      const img = await loadImage(src)
      // object-fit: cover
      const s  = Math.max(exportW / img.width, exportH / img.height)
      const sw = img.width  * s
      const sh = img.height * s
      ctx.drawImage(img, (exportW - sw) / 2, (exportH - sh) / 2, sw, sh)
    } catch {}
  }

  // 2. Éléments dans l'ordre du tableau (= ordre z dans Konva)
  const elements = (slideData.elements ?? []).filter(e => e.visible !== false)

  for (const el of elements) {
    ctx.save()
    ctx.globalAlpha = el.opacity ?? 1

    // Rotation autour du centre de l'élément (en coordonnées scalées)
    if (el.rotation) {
      const cx = ((el.x ?? 0) + (el.width  ?? 0) / 2) * scale
      const cy = ((el.y ?? 0) + (el.height ?? 0) / 2) * scale
      ctx.translate(cx, cy)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-cx, -cy)
    }

    if (el.type === 'text') {
      await renderText(ctx, el, scale, exportW)

    } else if (el.type === 'image' && el.src) {
      try {
        const src = el.src.startsWith('data:') || el.src.startsWith('http')
          ? el.src
          : resolve(UPLOADS, el.src)
        const img = await loadImage(src)
        ctx.drawImage(
          img,
          (el.x ?? 0) * scale,
          (el.y ?? 0) * scale,
          (el.width  ?? 100) * scale,
          (el.height ?? 100) * scale,
        )
      } catch {}

    } else if (el.type === 'shape') {
      renderShape(ctx, el, scale)
    }

    ctx.restore()
  }

  return canvas
}

// ── Word-wrap : découpe une ligne en plusieurs selon la largeur max ────────────

function wrapLine(ctx, text, maxWidth) {
  if (!text) return ['']
  // Si la ligne entière tient, pas besoin de découper
  if (ctx.measureText(text).width <= maxWidth) return [text]

  const words = text.split(' ')
  const lines = []
  let current = ''

  for (const word of words) {
    const test = current ? current + ' ' + word : word
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      // Si un seul mot dépasse déjà la largeur, on le garde quand même
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [text]
}

// ── Texte ─────────────────────────────────────────────────────────────────────

async function renderText(ctx, el, scale, canvasW) {
  const fontSize   = (el.fontSize ?? 24) * scale
  const fontFamily = el.fontFamily ?? 'sans-serif'
  const bold       = el.fontStyle?.includes('bold')   ? 'bold '   : ''
  const italic     = el.fontStyle?.includes('italic') ? 'italic ' : ''
  ctx.font         = `${italic}${bold}${fontSize}px "${fontFamily}", Arial, sans-serif`
  ctx.fillStyle    = el.fill ?? '#000000'

  const align   = el.align ?? 'left'
  ctx.textAlign = align

  const boxX   = (el.x ?? 0) * scale
  const boxW   = (el.width ?? (canvasW / scale)) * scale
  const lineH  = fontSize * (el.lineHeight ?? 1.2)
  const startY = (el.y ?? 0) * scale + fontSize * 0.85  // baseline approx

  // Point X selon l'alignement
  const textX = align === 'center' ? boxX + boxW / 2
              : align === 'right'  ? boxX + boxW
              : boxX

  // Effets
  if (el.contour?.active) {
    ctx.strokeStyle = el.contour.color ?? '#000000'
    ctx.lineWidth   = (el.contour.width ?? 2) * scale
    ctx.lineJoin    = 'round'
  }
  if (el.shadow?.active || el.effet3d?.active) {
    if (el.effet3d?.active) {
      ctx.shadowColor   = el.effet3d.color ?? '#333333'
      ctx.shadowOffsetX = (el.effet3d.depth ?? 5) * scale
      ctx.shadowOffsetY = (el.effet3d.depth ?? 5) * scale
      ctx.shadowBlur    = 0
    } else {
      ctx.shadowColor   = el.shadow.color ?? '#000000'
      ctx.shadowOffsetX = (el.shadow.offsetX ?? 4) * scale
      ctx.shadowOffsetY = (el.shadow.offsetY ?? 4) * scale
      ctx.shadowBlur    = (el.shadow.blur ?? 8) * scale
    }
  }

  // Découper d'abord sur les \n explicites, puis word-wrap dans chaque segment
  const rawLines = (el.text ?? '').split('\n')
  const allLines = rawLines.flatMap(raw => wrapLine(ctx, raw, boxW))

  allLines.forEach((line, i) => {
    const y = startY + i * lineH
    if (el.contour?.active) ctx.strokeText(line, textX, y)
    ctx.fillText(line, textX, y)
  })
}

// ── Forme ─────────────────────────────────────────────────────────────────────

function renderShape(ctx, el, scale) {
  const x  = (el.x ?? 0) * scale
  const y  = (el.y ?? 0) * scale
  const w  = (el.width  ?? 100) * scale
  const h  = (el.height ?? 100) * scale
  const r  = (el.cornerRadius ?? 0) * scale

  if (el.shadowEnabled && el.shadowColor) {
    ctx.shadowColor   = el.shadowColor
    ctx.shadowBlur    = (el.shadowBlur ?? 0) * scale
    ctx.shadowOffsetX = (el.shadowOffsetX ?? 0) * scale
    ctx.shadowOffsetY = (el.shadowOffsetY ?? 0) * scale
  }

  ctx.beginPath()
  if (el.shapeType === 'circle') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  } else {
    // rect avec cornerRadius
    if (r > 0) {
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.arcTo(x + w, y, x + w, y + r, r)
      ctx.lineTo(x + w, y + h - r)
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
      ctx.lineTo(x + r, y + h)
      ctx.arcTo(x, y + h, x, y + h - r, r)
      ctx.lineTo(x, y + r)
      ctx.arcTo(x, y, x + r, y, r)
      ctx.closePath()
    } else {
      ctx.rect(x, y, w, h)
    }
  }

  if (el.fillEnabled !== false && el.fill) {
    ctx.fillStyle = el.fill
    ctx.fill()
  }
  if (el.strokeWidth > 0 && el.stroke) {
    ctx.strokeStyle = el.stroke
    ctx.lineWidth   = el.strokeWidth * scale
    ctx.stroke()
  }
}

// ── Export public ─────────────────────────────────────────────────────────────

export async function renderPostToPng(post) {
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true })

  const slides = JSON.parse(post.vignettes ?? '[]')
  const slide  = slides[0]
  if (!slide) throw new Error('Aucune vignette dans ce post')

  const fmt    = IG_FORMATS_SERVER[post.format] ?? IG_FORMATS_SERVER.portrait
  const canvas = await renderSlide(slide, fmt.exportW, fmt.exportH)

  const filename = `planif-${post.id}-${Date.now()}.png`
  const filepath = resolve(OUTPUT_DIR, filename)
  await writeFile(filepath, canvas.toBuffer('image/png'))
  return `generated/${filename}`
}
