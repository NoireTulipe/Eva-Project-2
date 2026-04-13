/**
 * useGoogleFonts — charge dynamiquement les polices utilisées dans le canvas.
 *
 * - Google Fonts (googleFont != null) : injecte un <link> vers fonts.googleapis.com
 * - TTF/OTF locaux (fichier != null, googleFont == null) : injecte un @font-face
 *   pointant vers /uploads/instagram/fonts/<fichier>
 */
import { useEffect } from 'react'

const loaded = new Set()

function fontFaceId(family) {
  return `ff-${family.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase()}`
}

/**
 * Charge une police locale via @font-face dynamique.
 * family : nom CSS de la famille (= font.nom)
 * fichier : nom du fichier TTF/OTF sur le serveur
 */
export function loadLocalFont(family, fichier) {
  if (!family || !fichier) return
  const id = fontFaceId(family)
  if (document.getElementById(id)) return

  const ext  = fichier.split('.').pop().toLowerCase()
  const fmt  = ext === 'otf' ? 'opentype' : ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : 'truetype'
  const url  = `/uploads/instagram/fonts/${fichier}`

  const style = document.createElement('style')
  style.id = id
  style.textContent = `@font-face { font-family: "${family}"; src: url("${url}") format("${fmt}"); font-display: swap; }`
  document.head.appendChild(style)
}

export function useGoogleFonts(fonts) {
  useEffect(() => {
    if (!fonts?.length) return
    fonts.forEach(font => {
      if (font.googleFont) {
        loadGoogleFont(font.googleFont)
      } else if (font.fichier) {
        loadLocalFont(font.nom, font.fichier)
      }
    })
  }, [fonts])
}

/**
 * Injecte une Google Font à la volée.
 */
export function loadGoogleFont(family) {
  if (!family) return
  const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id   = id
  link.rel  = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`
  document.head.appendChild(link)
}
