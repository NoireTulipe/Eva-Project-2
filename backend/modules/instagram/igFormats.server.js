/**
 * igFormats.server.js — Dimensions des formats Instagram (côté serveur)
 * Miroir de frontend/src/components/instagram/igFormats.js pour node-canvas.
 */

export const IG_FORMATS_SERVER = {
  portrait: { exportW: 1080, exportH: 1350 },
  carre:    { exportW: 1080, exportH: 1080 },
  paysage:  { exportW: 1080, exportH: 566  },
  story:    { exportW: 1080, exportH: 1920 },
}
