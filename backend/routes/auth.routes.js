import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../config/db.js'
import { logAction, logError } from '../logs/logger.js'

const router = express.Router()

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !user.actif) {
      return res.status(401).json({ error: 'Identifiants invalides' })
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return res.status(401).json({ error: 'Identifiants invalides' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    const refresh = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    logAction(`Login réussi : ${user.email}`)

    res.json({
      token,
      refresh,
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email }
    })
  } catch (err) {
    logError(`Login erreur : ${err.message}`)
    res.status(500).json({ error: 'Erreur interne' })
  }
})

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh } = req.body

  if (!refresh) {
    return res.status(400).json({ error: 'Token de refresh requis' })
  }

  try {
    const payload = jwt.verify(refresh, process.env.JWT_SECRET)

    const user = await prisma.user.findUnique({ where: { id: payload.id } })

    if (!user || !user.actif) {
      return res.status(401).json({ error: 'Utilisateur invalide' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({ token })
  } catch (err) {
    res.status(401).json({ error: 'Refresh token invalide ou expiré' })
  }
})

export default router