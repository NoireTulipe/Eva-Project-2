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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())