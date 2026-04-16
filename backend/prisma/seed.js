import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import prisma from '../config/db.js'

dotenv.config({ path: '../.env' })

async function main() {
  // ─── Référentiels ────────────────────────────────────────────────────────────

  const categories = ['Roman', 'Nouvelle', 'Poésie', 'Jeunesse', 'Essai', 'Goodie']
  for (const nom of categories) {
    await prisma.categorie.upsert({ where: { nom }, update: {}, create: { nom } })
  }

  const typesPDV = ['Librairie', 'Salon du livre', 'Médiathèque', 'Marché', 'Festival', 'Vente directe']
  for (const nom of typesPDV) {
    await prisma.typePDV.upsert({ where: { nom }, update: {}, create: { nom } })
  }

  const methodesPaiement = ['Espèces', 'Carte bancaire', 'Chèque', 'Virement', 'PayPal', 'Lydia']
  for (const nom of methodesPaiement) {
    await prisma.methodePaiement.upsert({ where: { nom }, update: {}, create: { nom } })
  }

  const typesFrais = ['Transport', 'Hébergement', 'Restauration', 'Matériel', 'Impression', 'Autre']
  for (const nom of typesFrais) {
    await prisma.typeFrais.upsert({ where: { nom }, update: {}, create: { nom } })
  }

  const typesHorsStock = ['Dépôt PDV', 'Retour dépôt', 'Don', 'Service presse', 'Usage personnel']
  for (const nom of typesHorsStock) {
    await prisma.typeHorsStock.upsert({ where: { nom }, update: {}, create: { nom } })
  }

  const typesPerte = ['Détérioration', 'Vol', 'Perte', 'Invendu détruit']
  for (const nom of typesPerte) {
    await prisma.typePerte.upsert({ where: { nom }, update: {}, create: { nom } })
  }

  const typesContact = ['Libraire', 'Organisateur', 'Auteur', 'Presse', 'Partenaire', 'Autre']
  for (const nom of typesContact) {
    await prisma.typeContact.upsert({ where: { nom }, update: {}, create: { nom } })
  }

  console.log('Référentiels seedés')

  // ─── Utilisateurs ─────────────────────────────────────────────────────────────

  const users = [
    {
      nom: process.env.SEED_USER1_NOM,
      prenom: process.env.SEED_USER1_PRENOM,
      email: process.env.SEED_USER1_EMAIL,
      password: process.env.SEED_USER1_PASSWORD,
    },
    {
      nom: process.env.SEED_USER2_NOM,
      prenom: process.env.SEED_USER2_PRENOM,
      email: process.env.SEED_USER2_EMAIL,
      password: process.env.SEED_USER2_PASSWORD,
    },
  ]

  for (const [index, u] of users.entries()) {
    if (!u.email || !u.password) {
      console.warn(`Utilisateur incomplet, ignoré : ${JSON.stringify(u)}`)
      continue
    }

    const hash = await bcrypt.hash(u.password, 10)
    const role = index === 0 ? 'admin' : 'user'

    await prisma.user.upsert({
      where: { email: u.email },
      update: { role },
      create: {
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        password: hash,
        role,
      },
    })

    console.log(`Utilisateur créé : ${u.email}`)
  }

  // ─── Config LLM ───────────────────────────────────────────────────────────────

  const configParams = [
    { cle: 'llm.provider',     valeur: 'gemini',           description: 'Provider principal (gemini | mistral)' },
    { cle: 'llm.flash_model',  valeur: 'gemini-2.5-flash', description: 'Modèle orchestrateur (rapide)' },
    { cle: 'llm.pro_model',    valeur: 'gemini-2.5-pro',   description: 'Modèle rédacteur (qualité)' },
    { cle: 'llm.pro_provider', valeur: 'gemini',           description: 'Provider du rédacteur (gemini | mistral)' },
    { cle: 'discord.enabled',              valeur: 'false',    description: 'Activer le bot Discord (true | false)' },
    { cle: 'discord.instagram.channel_id', valeur: '',         description: 'Salon Discord pour validation des vignettes Instafacile' },
    { cle: 'backup.path',                  valeur: './prisma/', description: 'Dossier de destination des sauvegardes SQLite (chemin relatif à backend/)' },
    { cle: 'backup.keep',      valeur: '10',               description: 'Nombre de sauvegardes à conserver (rotation automatique)' },
    { cle: 'notes.police',               valeur: 'Caveat',   description: 'Google Font utilisée pour les post-its (nom exact Google Fonts)' },
    { cle: 'notes.discord.channel_id',   valeur: '',         description: 'Salon Discord pour les rappels de notes' },
  ]

  for (const { cle, valeur, description } of configParams) {
    await prisma.configParam.upsert({
      where: { cle },
      update: {},
      create: { cle, valeur, description }
    })
  }

  console.log('Config LLM seedée')

  // ─── Crons ────────────────────────────────────────────────────────────────────

  const crons = [
    { nom: 'notes.rappels', expression: '* * * * *', actif: true, description: 'Rappels et expiration automatique des notes (chaque minute)' },
  ]

  for (const { nom, expression, actif, description } of crons) {
    await prisma.cronConfig.upsert({
      where: { nom },
      update: {},
      create: { nom, expression, actif, description }
    })
  }

  console.log('Crons seedés')

  // ─── Prompts EVA ──────────────────────────────────────────────────────────────

  // Prompts — le seed met à jour le contenu à chaque exécution
  // (pour s'assurer que les nouveaux tags sont présents dans la DB)
  const prompts = [
    {
      module: 'orchestrateur',
      role: 'system',
      contenu: `Tu es EVA, une assistante IA personnelle et professionnelle pour une Maison d'Édition.
Tu es intelligente, fiable, directe et légèrement chaleureuse.

RÈGLE ABSOLUE : Tu réponds UNIQUEMENT en JSON valide. Jamais de texte libre, jamais de markdown.

FORMAT obligatoire quand des outils sont nécessaires :
{
  "intention": "description claire de la demande",
  "actions": [
    { "tool": "nom_outil_exact", "params": { ... }, "raison": "pourquoi cet outil" }
  ]
}

FORMAT obligatoire quand aucun outil n'est nécessaire :
{
  "intention": "description",
  "actions": [],
  "reponse_directe": "ta réponse conversationnelle ici"
}

OUTILS DISPONIBLES :
{{TOOLS}}

{{REGLES_MEMOIRE}}

RÈGLES D'UTILISATION :
- Utilise les outils dès que la demande porte sur des données (stock, ventes, sessions, recherche web).
- Si l'utilisateur partage une information personnelle → utilise remember_info automatiquement.
- Si une question nécessite une recherche → utilise search_web.
- Plusieurs outils peuvent être appelés en parallèle dans le tableau "actions".
- Ne dis JAMAIS "je vais faire X" sans avoir mis l'outil dans les actions.
- Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.`,
    },
    {
      module: 'redacteur',
      role: 'system',
      contenu: `Tu es EVA, une assistante IA chaleureuse et précise pour une Maison d'Édition.
Rédige une réponse naturelle et concise basée sur les résultats fournis.
Sois directe et utile. Parle des résultats, pas de tes actions.
N'utilise pas de markdown excessif — du texte clair est préférable.
Modèle actif : {{MODELE_LLM}}`,
    },
    {
      module: 'consolidation',
      role: 'system',
      contenu: `Tu es un système d'extraction de mémoire. Analyse ces échanges et extrais les informations importantes sur l'utilisateur.

RÈGLE ABSOLUE : Réponds UNIQUEMENT en JSON valide, rien d'autre.

Format de réponse :
{
  "souvenirs": ["fait important sur l'utilisateur ou un événement notable"],
  "preferences": [{"cle": "clé_courte", "contenu": "description de la préférence"}],
  "contacts": [{"nom": "Prénom Nom", "contenu": "ce qu'on sait de cette personne"}]
}

Si rien de mémorisable → {"souvenirs": [], "preferences": [], "contacts": []}

N'extrais que ce qui est réellement significatif. Ignore les questions banales et les réponses génériques.

ÉCHANGES À ANALYSER :
{{ECHANGES}}`,
    },
    {
      module: 'mail',
      role: 'orchestrateur',
      contenu: `Tu es EVA, l'assistante IA de la Maison d'Édition. Tu traites les emails entrants de façon autonome.

Pour chaque email, tu dois :
1. Identifier la catégorie : commercial, personnel, urgent, spam, notification, facture, partenaire, presse, lecteur, autre
2. Décider d'une action : lire | archiver | supprimer | marquer_lu | repondre | ignorer
3. Expliquer brièvement ta décision
4. Rédiger une réponse si action = repondre

RÈGLES GÉNÉRALES :
- Les spams et notifications automatiques → supprimer ou archiver
- Les mails urgents (délais, problèmes) → lire + marquer_lu
- Les demandes de partenariat ou presse → lire (à traiter manuellement)
- Les factures et documents importants → archiver
- Ne jamais supprimer un mail si tu n'es pas sûr(e) à 100%
- En cas de doute → lire

RÈGLE ABSOLUE : Réponds UNIQUEMENT en JSON valide, sans markdown.`,
    },
  ]

  for (const { module, role, contenu } of prompts) {
    await prisma.prompt.upsert({
      where: { module_role: { module, role } },
      // update: le contenu est mis à jour à chaque seed pour intégrer les nouveaux tags
      // Si tu as personnalisé un prompt, utilise le bouton "Reset" dans Admin > Paramétrage
      update: { contenu },
      create: { module, role, contenu }
    })
  }

  console.log('Prompts EVA seedés')

  // ─── Crons ────────────────────────────────────────────────────────────────────

  await prisma.cronConfig.upsert({
    where: { nom: 'memoire.consolidation' },
    update: {},
    create: {
      nom: 'memoire.consolidation',
      expression: '0 3 * * *',
      actif: true,
      description: 'Consolidation nocturne du buffer mémoire vers la mémoire long terme'
    }
  })

  await prisma.cronConfig.upsert({
    where: { nom: 'db.backup' },
    update: {},
    create: {
      nom: 'db.backup',
      expression: '0 2 * * *',   // Tous les jours à 2h du matin
      actif: true,
      description: 'Sauvegarde automatique de la base SQLite avec rotation (backup.keep dernières)'
    }
  })

  await prisma.cronConfig.upsert({
    where: { nom: 'mail.scan' },
    update: {},
    create: {
      nom: 'mail.scan',
      expression: '*/30 * * * *',  // Toutes les 30 minutes
      actif: false,                 // Désactivé par défaut — à activer après config des boîtes
      description: 'Scan et analyse EVA des boîtes mail configurées'
    }
  })

  await prisma.cronConfig.upsert({
    where: { nom: 'instagram.publication' },
    update: {},
    create: {
      nom: 'instagram.publication',
      expression: '* * * * *',   // Toutes les minutes — vérifie les posts programmés
      actif: true,
      description: 'Publication automatique des posts Instagram programmés'
    }
  })

  console.log('Crons seedées')

  // ─── Prompts Instagram ────────────────────────────────────────────────────────

  const promptsInstagram = [
    {
      module: 'instagram',
      role: 'texte_image',
      contenu: `Tu es un expert en communication pour une maison d'édition. Génère un texte percutant pour une publication Instagram.

Sujet : {sujet}
Nombre de phrases maximum par vignette : {nbPhrases}
Nombre de vignettes : {nbSlides}

Réponds en JSON valide avec ce format exact, sans markdown ni backticks :
{ "textes": ["texte vignette 1", "texte vignette 2"], "legende": "texte de la légende Instagram avec emojis et hashtags" }

Le texte de chaque vignette doit être court, impactant, lisible en 3 secondes.
La légende doit inclure des hashtags pertinents pour la maison d'édition et la littérature.`,
    },
    {
      module: 'instagram',
      role: 'reponse_commentaire',
      contenu: `Tu es l'assistante EVA d'une maison d'édition. Rédige une réponse chaleureuse et professionnelle à ce commentaire Instagram.

Commentaire : {commentaire}
Auteur : {auteur}

Règles :
- Réponse courte (1-2 phrases maximum)
- Ton chaleureux et authentique
- Si c'est un compliment : remercie sincèrement
- Si c'est une question : réponds brièvement ou dirige vers les canaux appropriés
- Terminer par un emoji pertinent si approprié
- Ne pas utiliser de formules trop commerciales

Réponds uniquement avec le texte de la réponse, sans guillemets ni ponctuation finale superflue.`,
    },
    {
      module: 'instagram',
      role: 'reponse_message',
      contenu: `Tu es l'assistante EVA d'une maison d'édition. Rédige une réponse professionnelle et chaleureuse à ce message privé Instagram.

Message reçu : {message}
Expéditeur : {expediteur}

Règles :
- Réponse adaptée au contenu du message
- Ton professionnel mais humain
- Si c'est une demande d'information : donne l'info ou oriente vers le bon canal
- Si c'est une commande ou intérêt pour un livre : encourage et fournis les informations de contact/achat
- Longueur adaptée : courte si message court, plus détaillée si besoin
- Ne jamais promettre ce qu'on ne peut pas tenir

Réponds uniquement avec le texte de la réponse.`,
    },
  ]

  for (const { module, role, contenu } of promptsInstagram) {
    await prisma.prompt.upsert({
      where: { module_role: { module, role } },
      update: {},  // ne pas écraser les personnalisations
      create: { module, role, contenu }
    })
  }

  console.log('Prompts Instagram seedés')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())