/**
 * instagram.renderer.js — Rendu serveur d'une vignette Instafacile en PNG
 *
 * Les coordonnées Konva sont en espace "display" (540px de large).
 * On applique scale = exportW / 540 pour obtenir 1080px.
 *
 * Chemins images : stockés côté front comme "/uploads/instagram/…"
 * → on strip le préfixe et on résout depuis le dossier uploads local.
 */

import { createCanvas, loadImage, registerFont } from 'canvas'
import { resolve, dirname, join }  from 'path'
import { fileURLToPath }           from 'url'
import { writeFile, mkdir }        from 'fs/promises'
import { existsSync }              from 'fs'
import { IG_FORMATS_SERVER }       from './igFormats.server.js'
import prisma                      from '../../config/db.js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const UPLOADS    = resolve(__dirname, '../../uploads/instagram')
const OUTPUT_DIR = resolve(UPLOADS, 'generated')

// Largeur d'affichage de référence côté front (igFormats.js → displayW)
const DISPLAY_W = 540

// ── Résolution des chemins images ─────────────────────────────────────────────
// Le front stocke les URLs comme "/uploads/instagram/backgrounds/file.jpg"
// On extrait la partie relative et on résout depuis UPLOADS.

function resolveUploadPath(value) {
  if (!value) return null
  if (value.startsWith('data:'))            return value  // data URL → direct
  if (value.startsWith('http://') || value.startsWith('https://')) return value  // URL externe → direct

  // Strip le préfixe connu
  let rel = value
  if (rel.startsWith('/uploads/instagram/')) rel = rel.slice('/uploads/instagram/'.length)
  else if (rel.startsWith('/'))              rel = rel.slice(1)

  return resolve(UPLOADS, rel)
}

// ── Polices : enregistrer via les noms DB (= ce qui est stocké dans fontFamily) ─

const _registeredFonts = new Set()

async function ensureFontsRegistered() {
  const fontsDir = resolve(__dirname, '../../uploads/instagram/fonts')
  if (!existsSync(fontsDir)) return
  try {
    // On utilise le nom DB comme family pour correspondre à el.fontFamily côté front
    const dbFonts = await prisma.igFont.findMany({ where: { fichier: { not: null } } })
    for (const font of dbFonts) {
      if (!font.fichier || _registeredFonts.has(font.fichier)) continue
      if (!font.fichier.match(/\.(ttf|otf|woff|woff2)$/i)) continue
      const path = join(fontsDir, font.fichier)
      if (!existsSync(path)) continue
      try {
        registerFont(path, { family: font.nom })
        _registeredFonts.add(font.fichier)
      } catch {}
    }
  } catch {}
}

// ── Word-wrap ─────────────────────────────────────────────────────────────────

function wrapLine(ctx, text, maxWidth) {
  if (!text || ctx.measureText(text).width <= maxWidth) return [text || '']
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test
    } else {
      if (cur) lines.push(cur)
      cur = word
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [text]
}

// ── Rendu d'une vignette ──────────────────────────────────────────────────────

async function renderSlide(slideData, exportW, exportH) {
  await ensureFontsRegistered()

  const scale  = exportW / DISPLAY_W
  const canvas = createCanvas(exportW, exportH)
  const ctx    = canvas.getContext('2d')

  // 1. Fond
  const bg = slideData.background
  if (!bg || bg.type === 'color') {
    ctx.fillStyle = bg?.value ?? '#ffffff'
    ctx.fillRect(0, 0, exportW, exportH)
  } else if (bg.type === 'image' && bg.value) {
    // Remplir d'abord avec blanc en fallback
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportW, exportH)
    try {
      const src = resolveUploadPath(bg.value)
      const img = await loadImage(src)
      // object-fit: cover
      const s  = Math.max(exportW / img.width, exportH / img.height)
      const sw = img.width  * s
      const sh = img.height * s
      ctx.drawImage(img, (exportW - sw) / 2, (exportH - sh) / 2, sw, sh)
    } catch (e) {
      // fond blanc déjà posé
    }
  }

  // 2. Éléments dans l'ordre du tableau (= ordre z Konva)
  const elements = (slideData.elements ?? []).filter(e => e.visible !== false)

  for (const el of elements) {
    ctx.save()
    ctx.globalAlpha = el.opacity ?? 1

    // Rotation autour du centre de l'élément
    if (el.rotation) {
      const cx = ((el.x ?? 0) + (el.width  ?? 0) / 2) * scale
      const cy = ((el.y ?? 0) + (el.height ?? 0) / 2) * scale
      ctx.translate(cx, cy)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-cx, -cy)
    }

    if (el.type === 'text') {
      renderText(ctx, el, scale, exportW)
    } else if (el.type === 'image' && el.src) {
      try {
        const src = resolveUploadPath(el.src)
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

// ── Texte ─────────────────────────────────────────────────────────────────────

function renderText(ctx, el, scale, canvasW) {
  const fontSize   = (el.fontSize ?? 24) * scale
  const fontFamily = el.fontFamily ?? 'Arial'
  const bold       = el.fontStyle?.includes('bold')   ? 'bold '   : ''
  const italic     = el.fontStyle?.includes('italic') ? 'italic ' : ''

  // Essayer la police demandée, avec Arial en fallback garanti
  ctx.font = `${italic}${bold}${fontSize}px ${fontFamily}, Arial, sans-serif`

  ctx.fillStyle = el.fill ?? '#000000'
  const align   = el.align ?? 'left'
  ctx.textAlign = align

  const boxX  = (el.x ?? 0) * scale
  const boxW  = (el.width  ?? (canvasW / scale)) * scale
  const boxH  = el.height ? el.height * scale : null
  const lineH = fontSize * (el.lineHeight ?? 1.2)

  // Point X selon l'alignement horizontal
  const textX = align === 'center' ? boxX + boxW / 2
              : align === 'right'  ? boxX + boxW
              : boxX

  // Pré-calcul du nombre de lignes pour l'alignement vertical
  // (on passe canvasW pour éviter une dépendance circulaire — les lignes seront
  //  recalculées de toute façon lors du fillText)
  const rawLinesPre = (el.text ?? '').split('\n')
  const allLinesPre = rawLinesPre.flatMap(raw => wrapLine(ctx, raw, boxW))
  const totalH      = allLinesPre.length * lineH

  // Baseline de départ selon verticalAlign
  const boxTop = (el.y ?? 0) * scale
  let startY
  if (boxH && el.verticalAlign === 'middle') {
    startY = boxTop + (boxH - totalH) / 2 + fontSize * 0.85
  } else if (boxH && el.verticalAlign === 'bottom') {
    startY = boxTop + boxH - totalH + fontSize * 0.85
  } else {
    startY = boxTop + fontSize * 0.85
  }

  // Effets shadow/contour
  if (el.effet3d?.active) {
    ctx.shadowColor   = el.effet3d.color ?? '#333333'
    ctx.shadowOffsetX = (el.effet3d.depth ?? 5) * scale
    ctx.shadowOffsetY = (el.effet3d.depth ?? 5) * scale
    ctx.shadowBlur    = 0
  } else if (el.shadow?.active) {
    ctx.shadowColor   = el.shadow.color ?? '#000000'
    ctx.shadowOffsetX = (el.shadow.offsetX ?? 4) * scale
    ctx.shadowOffsetY = (el.shadow.offsetY ?? 4) * scale
    ctx.shadowBlur    = (el.shadow.blur ?? 8) * scale
  }

  if (el.contour?.active) {
    ctx.strokeStyle = el.contour.color ?? '#000000'
    ctx.lineWidth   = (el.contour.width ?? 2) * scale
    ctx.lineJoin    = 'round'
  }

  // Découpe finale (identique au pré-calcul, ctx.font est déjà posé)
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
  const x = (el.x ?? 0) * scale
  const y = (el.y ?? 0) * scale
  const w = (el.width  ?? 100) * scale
  const h = (el.height ?? 100) * scale
  const r = (el.cornerRadius ?? 0) * scale

  if (el.shadowEnabled && el.shadowColor) {
    ctx.shadowColor   = el.shadowColor
    ctx.shadowBlur    = (el.shadowBlur ?? 0) * scale
    ctx.shadowOffsetX = (el.shadowOffsetX ?? 0) * scale
    ctx.shadowOffsetY = (el.shadowOffsetY ?? 0) * scale
  }

  ctx.beginPath()
  if (el.shapeType === 'circle') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  } else if (r > 0) {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  } else {
    ctx.rect(x, y, w, h)
  }

  if (el.fillEnabled !== false && el.fill) {
    ctx.fillStyle = el.fill
    ctx.fill()
  }
  if ((el.strokeWidth ?? 0) > 0 && el.stroke) {
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
