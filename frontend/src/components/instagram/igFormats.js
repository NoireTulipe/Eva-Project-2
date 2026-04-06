// Formats Instagram officiels (2025)
// Largeur d'affichage fixe à 540px — hauteur proportionnelle

export const IG_FORMATS = {
  portrait: {
    id: 'portrait',
    label: 'Portrait',
    subtitle: '4:5 — recommandé',
    exportW: 1080,
    exportH: 1350,
    displayW: 540,
    displayH: 675,
  },
  carre: {
    id: 'carre',
    label: 'Carré',
    subtitle: '1:1',
    exportW: 1080,
    exportH: 1080,
    displayW: 540,
    displayH: 540,
  },
  paysage: {
    id: 'paysage',
    label: 'Paysage',
    subtitle: '1.91:1',
    exportW: 1080,
    exportH: 566,
    displayW: 540,
    displayH: 283,
  },
  story: {
    id: 'story',
    label: 'Story / Reel',
    subtitle: '9:16',
    exportW: 1080,
    exportH: 1920,
    displayW: 540,
    displayH: 960,
  },
}

export const FORMAT_PAR_DEFAUT = 'portrait'
