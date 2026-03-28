export const NAV = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: '🏠',
  },
  {
    path: '/me',
    label: "Maison d'Édition",
    icon: '📦',
    children: [
      { path: '/me/ventes',       label: 'Ventes' },
      { path: '/me/produits',     label: 'Produits' },
      { path: '/me/pdv',          label: 'Points de vente' },
      { path: '/me/compta',       label: 'Comptabilité' },
      { path: '/me/referentiels', label: 'Référentiels' },
    ],
  },
  {
    path: '/eva',
    label: 'EVA',
    icon: '🤖',
    children: [
      { path: '/eva/supervision', label: 'Supervision' },
      { path: '/eva/mails',       label: 'Mails' },
      { path: '/eva/memoire',     label: 'Mémoire' },
      { path: '/eva/agenda',      label: 'Agenda' },
      { path: '/eva/notes',       label: 'Notes & Rappels' },
      { path: '/eva/site',        label: 'Site ME' },
    ],
  },
  {
    path: '/admin',
    label: 'Admin',
    icon: '⚙️',
    adminOnly: true,
    children: [
      { path: '/admin/parametrage',   label: 'Paramétrage EVA' },
      { path: '/admin/crons',         label: 'Tâches cron' },
      { path: '/admin/utilisateurs',  label: 'Utilisateurs' },
      { path: '/admin/logs',          label: 'Journaux' },
      { path: '/admin/sauvegardes',   label: 'Sauvegardes' },
      { path: '/admin/notifications', label: 'Notifications' },
    ],
  },
]
