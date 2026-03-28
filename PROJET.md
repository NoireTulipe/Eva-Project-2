## Ce qu'est EVA
Assistant IA pour une Maison d'Édition + gestion du quotidien.
Tourne sur un PC portable Ubuntu Server. Backend Node.js.
Interfaces : Web (principale), App Android JS, Discord (secondaire).

## Les règles du jeu
- Zéro hardcodé — tout paramétrable via l'interface web
- Un fichier = une fonctionnalité
- Architecture modulaire — un module en plus ne casse pas les autres
- Zéro approximation — EVA est fiable ou elle le dit
- From scratch, mais on récupère les scripts existants qui fonctionnent

## LLM Pipeline
- Gemini Flash, Gemini, Mistral — chaque modèle a son rôle
- Objectif : répartir les coûts intelligemment

## Modules

### 1. Ventes / Maison d'Édition
- Sessions de vente liées à un point de vente
- App mobile : tap sur un livre = vente enregistrée, stock retourné en temps réel
- Clôture de session : nb vendus, CA, bénéfice net (commission PDV + frais + droits auteur)
- Gestion produits : livres, goodies, stocks, frais d'approvisionnement
- Gestion points de vente avec leurs commissions
- Comptabilité complète

### 2. Gestion boîtes mail
- Ajout/config multi-boîtes (Gmail, Hotmail...) via interface web
- Script de connexion existant à récupérer
- Tâches cron paramétrables par boîte
- Règles par boîte — EVA catégorise et propose, elle n'agit pas seule
- Rapport quotidien des 24h sur l'interface web
- Validation / correction par l'utilisateur → loggée → EVA apprend (boucle RLHF maison)

### 3. Site web Maison d'Édition
- **Prioritaire :** ajout de produits en vente (script existant à récupérer)
- **Plus tard :** gestion actualités, calendrier d'événements (architecture prévue, code plus tard)

### 4. Mémoire dynamique
- Embedding — infos clés : contacts, famille, activité ME
- Accessible depuis Discord, web, app
- Scripts existants à récupérer

### 5. Agenda
- Gestion d'un agenda google_calendar

### 6. Notes & rappels
- Ex: "rappelle-moi dans 2 jours de prendre du pain"

### 7. Navigation / recherche internet

## Architecture outils Discord
Les outils sont groupés par catégorie dans le code.
Chaque salon Discord = une catégorie d'outils injectée.
EVA n'a accès qu'aux outils du salon actif — elle reste concentrée.