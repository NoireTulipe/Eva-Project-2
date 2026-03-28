import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import prisma from '../config/db.js'

dotenv.config({ path: '../.env' })

async function main() {
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

  for (const u of users) {
    if (!u.email || !u.password) {
      console.warn(`Utilisateur incomplet, ignoré : ${JSON.stringify(u)}`)
      continue
    }

    const hash = await bcrypt.hash(u.password, 10)

    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        password: hash,
      },
    })

    console.log(`Utilisateur créé : ${u.email}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())