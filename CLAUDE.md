# EVA v2 — Contexte projet pour Claude Code

## Ce qu'est EVA
Assistant IA personnel et professionnel pour une Maison d'Édition (ME).
Tourne sur Ubuntu Server à ressources limitées (≈3 Go RAM).
Interfaces : Web (principale), App Android (Capacitor), Discord (secondaire).

---

## Règles absolues — ne jamais déroger

- **Zéro hardcodé.** Tout paramétrable depuis l'interface web (via SQLite).
- **Un fichier = une fonctionnalité.** Pas de fichiers fourre-tout.
- **Architecture modulaire.** Ajouter un module ne casse pas les autres.
- **Zéro approximation.** EVA est fiable ou elle le dit explicitement.
- **Compta et calculs financiers = code pur, jamais un LLM.**
- **Ne jamais modifier un fichier sans demande explicite.**
- **Ne jamais coder sans validation préalable de ce qu'on va faire.**
- **Diff plutôt que réécriture complète quand c'est possible.**

---

## Stack technique

### Backend
- Node.js + Express
- SQLite (via Prisma) — toutes les données structurées
- `@xenova/transformers` — embeddings natif Node.js, zéro Python
- Vecteurs stockés dans SQLite, similarité cosinus en JS

### Frontend
- React + Vite + Tailwind CSS
- `react-router-dom` v6
- Monorepo npm workspaces (`backend/` + `frontend/`)

### App Android
- Capacitor — build depuis la base React du frontend
- UI spécifique mobile, pas une transposition du web

### Infra
- Caddy — reverse proxy + HTTPS Let's Encrypt auto
- Sous-domaine : `eva.echodeplumes.com` (domaine LWS)
- DDNS : cron 5 min → détecte changement IP → API LWS pour MAJ enregistrement A

### Auth
- JWT (access 24h + refresh 7j)
- Deux utilisateurs : propriétaire (`role: admin`) + conjoint (`role: user`)
- Le rôle est inclus dans le JWT et la réponse de login

### Secrets
- `.env` — clés API, JWT secret (jamais versionné)
- SQLite — tout le reste de la config

---

## Pipeline LLM

| Rôle | Modèle | Fixe ? |
|------|--------|--------|
| Orchestrateur | Gemini Flash | Oui, non interchangeable |
| Rédacteur | Gemini ou Mistral | Sélectionnable par module depuis l'UI |
| Outils | Fonctions JS | — |

- Chaque étape a son propre prompt système.
- Tous les prompts sont en SQLite, éditables depuis l'interface web.
- Seule la catégorie d'outils correspondant au contexte est injectée.

---

## Navigation — 4 espaces distincts

```
┌──────────────────────────────────────────────────────────┐
│  🏠 Dashboard │ 📦 Maison d'Édition │ 🤖 EVA │ ⚙️ Admin  │
└──────────────────────────────────────────────────────────┘
```

- Icône + texte dans la navbar principale
- Sous-navigation contextuelle pour chaque espace (sauf Dashboard)
- **Admin visible uniquement pour `role: admin`** (masqué pour `role: user`)

### 🏠 Dashboard
Tableau de bord modulaire avec widgets configurables par utilisateur.

### 📦 Maison d'Édition (`/me`)
```
/me/ventes        — Sessions de vente (active + historique)
/me/produits      — Catalogue produits (livres, goodies)
/me/pdv           — Points de vente
/me/compta        — Comptabilité (stub)
/me/referentiels  — Référentiels / thésaurus métier
```

### 🤖 EVA (`/eva`)
```
/eva/supervision  — Tâches en attente de validation (stub)
/eva/mails        — Boîtes mail, rapport 24h, RLHF (stub)
/eva/memoire      — Mémoire dynamique (stub)
/eva/agenda       — Agenda (stub)
/eva/notes        — Notes & Rappels (stub)
/eva/site         — Site ME (stub)
```

### ⚙️ Admin (`/admin`) — role: admin uniquement
```
/admin/parametrage    — Modèles LLM, prompts système (stub)
/admin/crons          — Tâches cron (stub)
/admin/utilisateurs   — Comptes et rôles (stub)
/admin/logs           — Journaux erreurs/actions (stub)
/admin/sauvegardes    — Backup SQLite (stub)
/admin/notifications  — Canaux par type d'événement (stub)
```

---

## Arborescence complète

```
eva-v2/
├── .env                          # jamais versionné
├── .gitignore
├── README.md
├── CLAUDE.md                     # ce fichier
├── package.json                  # npm workspaces (backend + frontend)
│
├── backend/
│   ├── package.json              # prisma.seed configuré
│   ├── server.js                 # Express, routes montées : /auth /ventes /ref
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   ├── auth.js               # JWT Bearer
│   │   └── logger.js
│   ├── routes/
│   │   ├── auth.routes.js        # POST /auth/login, POST /auth/refresh
│   │   ├── ventes.routes.js      # 15 endpoints (produits, PDV, sessions, ventes)
│   │   ├── referentiels.routes.js # CRUD générique GET/POST/PUT/DELETE /ref/:table
│   │   ├── mail.routes.js        # (à créer)
│   │   ├── agenda.routes.js      # (à créer)
│   │   ├── notes.routes.js       # (à créer)
│   │   ├── memoire.routes.js     # (à créer)
│   │   ├── site.routes.js        # (à créer)
│   │   └── admin.routes.js       # (à créer)
│   ├── modules/
│   │   ├── ventes/
│   │   │   ├── ventes.service.js  # CRUD + sessions + calculs
│   │   │   └── ventes.calculs.js  # JS pur, zéro LLM
│   │   ├── mail/         # (à créer)
│   │   ├── agenda/       # (à créer)
│   │   ├── notes/        # (à créer)
│   │   ├── memoire/      # (à créer)
│   │   └── site/         # (à créer)
│   ├── llm/
│   │   ├── orchestrateur.js      # (à créer)
│   │   ├── redacteur.js          # (à créer)
│   │   └── embeddings.js         # (à créer)
│   ├── tools/categories/         # (à créer — mail, ventes, agenda, memoire, site)
│   ├── discord/                  # (à créer)
│   ├── notifications/            # (à créer)
│   ├── vocal/                    # (à créer — TTS Piper, STT Voxtral)
│   ├── logs/
│   │   └── logger.js             # errors.log + actions.log
│   ├── crons/                    # (à créer)
│   └── prisma/
│       ├── schema.prisma         # 25+ modèles, 5 migrations appliquées
│       ├── seed.js               # référentiels + 2 utilisateurs
│       └── dev.db
│
├── frontend/
│   ├── package.json              # react, react-dom, react-router-dom, vite, tailwind
│   ├── vite.config.js            # proxy /api → localhost:3000
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx              # SessionProvider + App
│       ├── App.jsx               # routing React Router v6, PrivateRoute, AdminRoute
│       ├── index.css
│       ├── shared/
│       │   ├── api.js            # client HTTP JWT (auto-refresh 401), toutes les fonctions
│       │   ├── nav.js            # config navigation centralisée (NAV)
│       │   ├── SessionContext.jsx # contexte session active + persistance localStorage
│       │   └── hooks/
│       │       └── useApi.js     # { data, loading, error, refetch }
│       ├── components/web/
│       │   ├── Layout.jsx        # Navbar + SubNav + <Outlet>
│       │   ├── Navbar.jsx        # 4 onglets icône+texte, pastille session active
│       │   ├── SubNav.jsx        # sous-navigation contextuelle
│       │   ├── SelectRef.jsx     # select + bouton [+] + modale Portal
│       │   ├── Spinner.jsx
│       │   └── ErrorMessage.jsx
│       └── pages/web/
│           ├── LoginPage.jsx
│           ├── Dashboard.jsx
│           ├── me/
│           │   ├── Ventes.jsx    # session active (Context) + historique dépliable
│           │   ├── Produits.jsx
│           │   ├── PDV.jsx
│           │   ├── Compta.jsx    # stub
│           │   └── Referentiels.jsx
│           ├── eva/
│           │   ├── Supervision.jsx  # stub
│           │   ├── Mails.jsx        # stub
│           │   ├── Memoire.jsx      # stub
│           │   ├── Agenda.jsx       # stub
│           │   ├── Notes.jsx        # stub
│           │   └── Site.jsx         # stub
│           └── admin/
│               ├── Parametrage.jsx  # stub
│               ├── Crons.jsx        # stub
│               ├── Utilisateurs.jsx # stub
│               ├── Logs.jsx         # stub
│               ├── Sauvegardes.jsx  # stub
│               └── Notifications.jsx # stub
│
└── caddy/
    └── Caddyfile
```

---

## Modules — résumé fonctionnel

### 1. Ventes / Maison d'Édition ✅ IMPLÉMENTÉ
- Sessions de vente liées à un PDV
- Session active persistée via `SessionContext` + localStorage + détection auto au démarrage
- Pastille "Session ouverte" dans la Navbar (lien direct)
- Historique des sessions dépliable avec détail des ventes
- CRUD produits (avec catégorie via SelectRef), PDV, ventes, annulations
- Clôture : recap financier (CA, commission PDV, droits auteur, frais, bénéfice net)
- Référentiels (7 tables) gérés dans ME > Référentiels
- Calculs financiers en JS pur (`ventes.calculs.js`), jamais via LLM
- Auteurs : schéma prêt, formulaire produit non encore implémenté côté UI

### 2. Référentiels ✅ IMPLÉMENTÉ
Route générique `GET/POST/PUT/DELETE /ref/:table` pour :
`categories`, `types-pdv`, `methodes-paiement`, `types-frais`, `types-hors-stock`, `types-perte`, `types-contact`

Composant `SelectRef` : select + `[+]` (modale Portal) → sélection auto de la nouvelle entrée.

### 3. Boîtes mail — À FAIRE
- Multi-boîtes (Gmail, Hotmail...) via Microsoft Graph + Gmail API
- Crons paramétrables par boîte
- EVA catégorise et propose — elle n'agit jamais seule
- Rapport quotidien, boucle RLHF (validation → loggée → EVA apprend)

### 4. Site web ME — À FAIRE
- Prioritaire : ajout produits en vente (script v1 à récupérer)
- WooCommerce + WordPress (credentials dans `.env`)

### 5. Mémoire dynamique — À FAIRE
- Buffer journalier → consolidation nocturne LLM → tables long terme
- Tables : contacts, préférences, souvenirs (par utilisateur)
- Recherche sémantique via `@xenova/transformers` + similarité cosinus

### 6. Agenda — À FAIRE
- CRUD événements, consultation par date
- Accessible web, app, Discord

### 7. Notes & Rappels — À FAIRE
- Rappels en langage naturel ("dans 2 jours...")
- Cron de vérification via cron.manager.js

### 8. LLM / Orchestrateur — À FAIRE
- Gemini Flash (orchestrateur fixe) + Gemini/Mistral (rédacteur sélectionnable)
- Prompts en SQLite, éditables depuis l'UI Admin
- Outils injectés par contexte (catégories)

### 9. Discord — À FAIRE
- Routing salon → outils

### 10. Vocal — À FAIRE
- TTS : Piper en local
- STT : Voxtral via API Mistral

---

## Référentiels seedés

7 tables pré-remplies avec valeurs par défaut :
- **Catégories** : Roman, Nouvelle, Poésie, Jeunesse, Essai, Goodie
- **Types PDV** : Librairie, Salon du livre, Médiathèque, Marché, Festival, Vente directe
- **Méthodes paiement** : Espèces, Carte bancaire, Chèque, Virement, PayPal, Lydia
- **Types frais** : Transport, Hébergement, Restauration, Matériel, Impression, Autre
- **Types hors-stock** : Dépôt PDV, Retour dépôt, Don, Service presse, Usage personnel
- **Types perte** : Détérioration, Vol, Perte, Invendu détruit
- **Types contact** : Libraire, Organisateur, Auteur, Presse, Partenaire, Autre

---

## Notifications
- Deux canaux : Discord + push Android
- Configurables depuis l'UI Admin > Notifications (stub)

## Logs
- `backend/logs/errors.log` et `backend/logs/actions.log`
- Consultables depuis Admin > Journaux (stub — endpoint backend à créer)
- Rotation automatique à implémenter

## Sauvegardes
- Cron automatique SQLite, destination configurable
- Rotation (garder N dernières), notification en cas d'échec
- À implémenter dans `backend/crons/backup.cron.js`

---

## Scripts EVA v1 à récupérer
- Connexion boîtes mail (Microsoft Graph + Gmail)
- Embeddings / mémoire (`@xenova/transformers`)
- Ajout produits site ME (WooCommerce)
- TTS (Piper)
- STT (Voxtral)
- Agenda

---

## Commandes utiles

```bash
# Démarrer (depuis la racine)
npm run dev:backend    # backend port 3000
npm run dev:frontend   # frontend port 5173 (proxy /api → 3000)

# Base de données
cd backend
npx prisma studio              # explorer la base
npx prisma migrate dev --name <nom>  # nouvelle migration
npx prisma db seed             # reseed référentiels + utilisateurs
npx prisma db push             # sync schema sans migration (dev only)
```

---

## État d'avancement

### Backend
- [x] Express + middleware (auth JWT, logger)
- [x] Prisma + SQLite (5 migrations, 25+ modèles)
- [x] Seed référentiels + 2 utilisateurs (admin/user)
- [x] Module Ventes complet (15 endpoints)
- [x] Route référentiels générique (`/ref/:table`)
- [ ] Module Mail
- [ ] Module Agenda
- [ ] Module Notes
- [ ] Module Mémoire + embeddings
- [ ] Module Site ME
- [ ] LLM orchestrateur + rédacteur
- [ ] Outils LLM par catégorie
- [ ] Discord bot
- [ ] Notifications (Discord + Android)
- [ ] Vocal (TTS/STT)
- [ ] Crons (manager, DDNS, backup)
- [ ] Routes Admin (logs, config, crons, utilisateurs)

### Frontend
- [x] Vite + React + Tailwind + React Router v6
- [x] Auth (login, refresh auto, logout)
- [x] Navigation 4 espaces (Navbar + SubNav), Admin masqué pour `role: user`
- [x] SessionContext (persistance + détection auto session ouverte)
- [x] Composant SelectRef (select + modale Portal + auto-sélection)
- [x] ME > Ventes (session active + historique)
- [x] ME > Produits (CRUD)
- [x] ME > PDV (CRUD)
- [x] ME > Référentiels (CRUD 7 tables)
- [ ] ME > Comptabilité
- [ ] Dashboard (widgets configurables)
- [ ] EVA > tous les modules (stubs en place)
- [ ] Admin > tous les modules (stubs en place)
- [ ] App Android (Capacitor)
