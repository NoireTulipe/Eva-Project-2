# EVA v2 — Spécifications techniques

## Contexte

EVA est un assistant IA personnel et professionnel. Elle tourne sur un PC portable Ubuntu Server à ressources limitées (≈3Go RAM). Elle gère le quotidien d'une Maison d'Édition (ME) et des tâches personnelles.

EVA v1 existait et fonctionnait partiellement. On repart from scratch mais on récupère les scripts existants qui fonctionnent. Le code sera versionné sur GitHub.

---

## Règles absolues

- Zéro hardcodé. Tout ce qui peut être paramétré l'est depuis l'interface web.
- Un fichier = une fonctionnalité.
- Architecture modulaire. L'ajout d'un module ne casse pas les autres.
- Zéro approximation. EVA est fiable ou elle le dit explicitement.
- La compta et les calculs financiers sont faits par le code, jamais par un LLM.

---

## Stack technique

### Backend
- Node.js
- Express ou Fastify
- SQLite — toutes les données structurées
- @xenova/transformers — génération des embeddings en Node.js natif (zéro dépendance Python)
- Les vecteurs d'embeddings sont stockés dans SQLite, similarité cosinus gérée en JS

### Frontend web
- React + Vite
- Tailwind CSS
- Deux espaces distincts : interface métier / interface administration

### App Android
- Capacitor (base React partagée avec le web)
- UI pensée spécifiquement mobile — pas une transposition du web
- Structure partagée :
  - src/components/web/ — composants desktop
  - src/components/app/ — composants mobile
  - src/shared/ — logique métier commune

### Accès distant
- Caddy comme reverse proxy (gère Let's Encrypt automatiquement)
- Sous-domaine eva.echodeplumes.com (domaine LWS)
- Cron toutes les 5 minutes : récupère l'IP externe, si changée → appel API LWS pour mettre à jour l'enregistrement A du sous-domaine
- HTTPS obligatoire

### Authentification
- JWT
- Utilisateurs liés à un profil (au minimum : le propriétaire + sa femme)

### Variables sensibles
- Fichier .env — clés API, mots de passe, secrets JWT (jamais versionné)
- SQLite — tout le reste de la configuration paramétrable

---

## Pipeline LLM

Trois rôles distincts :

**Orchestrateur — Gemini Flash**
Décompose la tâche, détermine les étapes, appelle les outils. Toujours Gemini Flash, pas interchangeable.

**Rédacteur — Gemini ou Mistral**
Compile les résultats des outils, formule la réponse finale dans un langage engageant. Le modèle est sélectionnable depuis l'interface web, par module.

**Outils — fonctions JS**
Les outils sont groupés par catégorie. Seule la catégorie correspondante est injectée selon le contexte.

Chaque étape du pipeline a son propre prompt système. Tous les prompts sont stockés en SQLite et éditables depuis l'interface web.

---

## Architecture des outils Discord

Chaque salon Discord correspond à une catégorie fonctionnelle. EVA n'a accès qu'aux outils du salon actif.

```
tools/
  categories/
    mail.tools.js
    ventes.tools.js
    agenda.tools.js
    memoire.tools.js
    site.tools.js
    ...
```

---

## Mémoire EVA

La mémoire fonctionne sur deux couches distinctes.

### Couche 1 — Mémoire dynamique (embeddings)

Trois niveaux :

**Buffer (mémoire immédiate)**
Tout ce qu'EVA capte durant la journée — conversations, informations reçues quel que soit le vecteur. Stocké temporairement.

**Consolidation nocturne**
Un LLM trie le buffer, évalue la pertinence, synthétise. Seul ce qui a de la valeur long terme est vectorisé et versé dans les tables mémoire.

**Tables long terme**
- contacts
- préférences
- souvenirs

Chaque entrée est liée à un utilisateur (les préférences de l'un ne polluent pas celles de l'autre).

### Couche 2 — Base de données structurée

EVA peut interroger toutes les tables SQLite pour répondre à une question. Si on lui parle d'un livre, elle cherche dans les produits. Si on lui parle d'un point de vente, elle cherche dans la table PDV. L'orchestrateur décide où chercher. L'utilisateur pose sa question, EVA trouve.

---

## Modules

### 1. Ventes / Maison d'Édition

**Sessions de vente**
- Ouverture liée à un point de vente
- Enregistrement des ventes en temps réel depuis l'app (tap sur un livre)
- Retour du stock actualisé immédiatement
- Clôture : nombre vendus, CA, bénéfice net

**Calcul du bénéfice net**
Commission point de vente + frais divers + droits d'auteur = déductions. Tout paramétrable. Zéro LLM dans ces calculs.

**Gestion des produits**
- Livres et goodies
- Stocks, alertes de seuil, mouvements
- Frais d'approvisionnement

**Gestion des points de vente**
- Nom, localité, contacts, moyens de contact
- Type de point de vente
- Commission associée (paramétrable)

**Comptabilité**
- Recettes, dépenses, bénéfices par session et par période (jour, semaine, mois, année, personnalisé)
- Suivi des frais
- Tout calculé par le code. L'IA intervient uniquement pour commenter, analyser les tendances ou répondre à des questions en langage naturel sur les chiffres produits.

### 2. Gestion des boîtes mail

- Ajout et configuration multi-boîtes (Gmail, Hotmail, etc.) depuis l'interface web
- Script de connexion existant à récupérer
- Tâches cron paramétrables par boîte
- Règles par boîte — EVA catégorise et propose, elle n'agit pas seule
- Rapport quotidien des 24h sur l'interface web
- Validation ou correction par l'utilisateur → loggée → EVA affine ses règles (boucle RLHF maison)

### 3. Site web Maison d'Édition

Prioritaire : ajout de produits en vente. Script existant à récupérer.
Prévu mais pas prioritaire : gestion des actualités, calendrier d'événements. L'architecture prévoit la place, le code viendra plus tard.

### 4. Agenda

- Ajout de dates, consultation par date
- Accessible depuis Discord, web, app
- Scripts existants à récupérer

### 5. Notes et rappels

- Rappels temporels en langage naturel ("rappelle-moi dans 2 jours de...")
- Accessible depuis toutes les interfaces

### 6. Navigation et recherche internet

À définir lors de l'implémentation.

---

## Notifications

Deux canaux : Discord et push sur l'app Android.
Configurables depuis l'interface web par type d'événement. Rien de hardcodé.

---

## Logs

Deux fichiers distincts :
- Log erreurs — uniquement ce qui merde
- Log actions — tout ce qu'EVA fait

Les deux consultables depuis l'interface web avec filtres par date et par module. Rotation automatique pour ne pas saturer le disque.

---

## Sauvegardes

- Cron de sauvegarde automatique de SQLite
- Destination configurable depuis l'interface web (stockage externe USB)
- Rotation des sauvegardes (garder N dernières)
- Notification en cas d'échec

---

## Synthèse vocale et reconnaissance vocale

- TTS : Piper en local
- STT : Voxtral via API Mistral
- Disponibles sur web et app Android
- Scripts existants à récupérer

---

## Ce qui reste à définir

- Structure précise des tables SQLite (à faire module par module)
- Arborescence complète du projet
- Détail du schéma de la base de données
- Détail de l'API entre backend et interfaces