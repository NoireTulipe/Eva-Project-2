/**
 * useGoogleFonts — charge dynamiquement les Google Fonts utilisées dans le canvas.
 *
 * Pour chaque font avec googleFont != null, injecte :
 *   <link href="https://fonts.googleapis.com/css2?family=Nom+Font&display=swap" rel="stylesheet">
 * et attend que la font soit disponible dans le document avant de notifier Konva.
 */
import { useEffect } from 'react'

const loaded = new Set() // fonts déjà injectées dans cette session

export function useGoogleFonts(fonts) {
  useEffect(() => {
    if (!fonts?.length) return

    fonts.forEach(font => {
      if (!font.googleFont) return
      const family = font.googleFont.trim()
      if (loaded.has(family)) return
      loaded.add(family)

      // Injecter le <link> si pas déjà présent
      const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`
      if (document.getElementById(id)) return

      const link = document.createElement('link')
      link.id   = id
      link.rel  = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`
      document.head.appendChild(link)
    })
  }, [fonts])
}

/**
 * Injecte une Google Font à la volée (appelable sans hook, ex: depuis la biblio).
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
