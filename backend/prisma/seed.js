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
    { cle: 'discord.enabled',  valeur: 'false',            description: 'Activer le bot Discord (true | false)' },
  ]

  for (const { cle, valeur, description } of configParams) {
    await prisma.configParam.upsert({
      where: { cle },
      update: {},
      create: { cle, valeur, description }
    })
  }

  console.log('Config LLM seedée')

  // ─── Prompts EVA ──────────────────────────────────────────────────────────────

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

RÈGLES D'UTILISATION :
- Utilise les outils dès que la demande porte sur des données (stock, ventes, sessions, recherche web).
- Si l'utilisateur partage une information personnelle → utilise remember_info automatiquement.
- Si une question nécessite une recherche → utilise search_web.
- Plusieurs outils peuvent être appelés en parallèle dans le tableau "actions".
- Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.`,
    },
    {
      module: 'redacteur',
      role: 'system',
      contenu: `Tu es EVA, une assistante IA chaleureuse et précise pour une Maison d'Édition.
Rédige une réponse naturelle et concise basée sur les résultats fournis.
Sois directe et utile. Parle des résultats, pas de tes actions.
N'utilise pas de markdown excessif — du texte clair est préférable.`,
    },
  ]

  for (const { module, role, contenu } of prompts) {
    await prisma.prompt.upsert({
      where: { module_role: { module, role } },
      update: {},
      create: { module, role, contenu }
    })
  }

  console.log('Prompts EVA seedés')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())