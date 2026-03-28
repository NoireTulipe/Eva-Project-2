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
- Deux espaces : interface métier / interface admin
- Monorepo npm workspaces (`backend/` + `frontend/`)

### App Android
- Capacitor — build depuis la base React du frontend
- UI spécifique mobile, pas une transposition du web

### Infra
- Caddy — reverse proxy + HTTPS Let's Encrypt auto
- Sous-domaine : `eva.echodeplumes.com` (domaine LWS)
- DDNS : cron 5 min → détecte changement IP → API LWS pour MAJ enregistrement A

### Auth
- JWT
- Au minimum deux utilisateurs : propriétaire + conjoint

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

## Arborescence complète

```
eva-v2/
├── .env                          # jamais versionné
├── .gitignore
├── README.md
├── CLAUDE.md                     # ce fichier
├── package.json                  # npm workspaces
│
├── backend/
│   ├── package.json
│   ├── server.js                 # point d'entrée Express
│   ├── config/
│   │   └── db.js                 # init Prisma + migrations
│   ├── middleware/
│   │   ├── auth.js               # vérification JWT
│   │   └── logger.js             # log actions + erreurs
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── ventes.routes.js
│   │   ├── mail.routes.js
│   │   ├── agenda.routes.js
│   │   ├── notes.routes.js
│   │   ├── memoire.routes.js
│   │   ├── site.routes.js
│   │   └── admin.routes.js
│   ├── modules/
│   │   ├── ventes/
│   │   │   ├── ventes.service.js
│   │   │   └── ventes.calculs.js # zéro LLM ici
│   │   ├── mail/
│   │   │   ├── mail.service.js
│   │   │   └── mail.cron.js
│   │   ├── agenda/
│   │   │   └── agenda.service.js
│   │   ├── notes/
│   │   │   └── notes.service.js
│   │   ├── memoire/
│   │   │   ├── memoire.service.js
│   │   │   └── memoire.consolidation.js  # cron nocturne
│   │   └── site/
│   │       └── site.service.js
│   ├── llm/
│   │   ├── orchestrateur.js      # Gemini Flash — fixe
│   │   ├── redacteur.js          # modèle sélectionnable
│   │   └── embeddings.js         # @xenova/transformers
│   ├── tools/
│   │   └── categories/
│   │       ├── mail.tools.js
│   │       ├── ventes.tools.js
│   │       ├── agenda.tools.js
│   │       ├── memoire.tools.js
│   │       └── site.tools.js
│   ├── discord/
│   │   ├── bot.js                # init client Discord
│   │   └── handler.js            # routing salon → outils
│   ├── notifications/
│   │   └── notif.service.js      # Discord + push Android
│   ├── vocal/
│   │   ├── tts.js                # Piper local
│   │   └── stt.js                # Voxtral via API Mistral
│   ├── logs/
│   │   └── logger.js             # erreurs + actions séparés
│   ├── crons/
│   │   ├── cron.manager.js       # registre central, lit SQLite
│   │   ├── ddns.cron.js          # MAJ IP → API LWS
│   │   └── backup.cron.js        # sauvegarde SQLite + rotation
│   └── db/
│       └── migrations/           # fichiers SQL numérotés
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               # routing React
│       ├── shared/
│       │   ├── api.js            # client HTTP vers backend
│       │   └── hooks/            # hooks React partagés
│       ├── components/
│       │   ├── web/              # composants desktop
│       │   └── app/              # composants mobile Capacitor
│       └── pages/
│           ├── web/
│           │   ├── Dashboard.jsx
│           │   ├── Ventes.jsx
│           │   ├── Mail.jsx
│           │   ├── Agenda.jsx
│           │   ├── Memoire.jsx
│           │   ├── Admin.jsx
│           │   └── Logs.jsx
│           └── app/
│               ├── AppHome.jsx
│               └── AppVentes.jsx # tap sur livre = vente
│
└── caddy/
    └── Caddyfile
```

---

## Modules — résumé fonctionnel

### 1. Ventes / Maison d'Édition
- Sessions de vente liées à un PDV
- App mobile : tap livre → vente enregistrée → stock mis à jour en temps réel
- Clôture : nb vendus, CA, bénéfice net (commission PDV + frais + droits auteur)
- Gestion produits (livres, goodies), stocks, alertes seuil
- Gestion PDV (nom, localité, contacts, commission paramétrable)
- Comptabilité complète — **calculs en JS, jamais en LLM**

### 2. Boîtes mail
- Multi-boîtes (Gmail, Hotmail...) configurables depuis l'UI
- Crons paramétrables par boîte
- EVA catégorise et propose — elle n'agit jamais seule
- Rapport quotidien sur l'UI web
- Boucle RLHF maison : validation utilisateur → loggée → EVA apprend

### 3. Site web ME
- Prioritaire : ajout produits en vente (script v1 à récupérer)
- Prévu plus tard : actualités, calendrier événements

### 4. Mémoire dynamique
- Buffer journalier → consolidation nocturne LLM → tables long terme
- Tables : contacts, préférences, souvenirs (par utilisateur)
- Couche 2 : interrogation SQLite structurée par l'orchestrateur

### 5. Agenda
- CRUD événements, consultation par date
- Accessible web, app, Discord

### 6. Notes & rappels
- Rappels en langage naturel ("dans 2 jours...")
- Cron de vérification via cron.manager.js

### 7. Navigation / recherche internet
- À définir lors de l'implémentation

---

## Notifications
- Deux canaux : Discord + push Android
- Configurables depuis l'UI par type d'événement

## Logs
- Deux fichiers distincts : erreurs / actions
- Consultables depuis l'UI avec filtres date + module
- Rotation automatique

## Vocal
- TTS : Piper en local
- STT : Voxtral via API Mistral

## Sauvegardes
- Cron automatique SQLite, destination configurable (USB)
- Rotation (garder N dernières), notification en cas d'échec

---

## État d'avancement (à mettre à jour manuellement)

- [x] Dépôt GitHub créé
- [x] Monorepo npm workspaces initialisé
- [x] Structure dossiers frontend/src créée
  - `shared/`, `shared/hooks/`
  - `components/web/`, `components/app/`
  - `pages/web/`, `pages/app/`
- [ ] Fichiers de base frontend : `main.jsx`, `App.jsx`, `shared/api.js`
- [ ] Pages stubs web et app
- [ ] Backend : server.js, db.js, middleware
- [ ] ...

---

## Scripts EVA v1 à récupérer
- Connexion boîtes mail
- Embeddings / mémoire
- Ajout produits site ME
- TTS (Piper)
- STT (Voxtral)
- Agenda