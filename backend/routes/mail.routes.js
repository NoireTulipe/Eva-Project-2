import { Router } from 'express'
import prisma from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logAction, logError } from '../logs/logger.js'
import { testConnection, fetchEmails, listerDossiers } from '../modules/mail/imap.service.js'
import { testSmtp, envoyerEmail } from '../modules/mail/smtp.service.js'

const router = Router()
router.use(authMiddleware)

// ─── BOÎTES MAIL ──────────────────────────────────────────────────────────────

// GET /mail/boites
router.get('/boites', async (req, res) => {
  const boites = await prisma.boiteMail.findMany({
    orderBy: { nom: 'asc' },
    select: {
      id: true, nom: true, email: true, provider: true, actif: true,
      imapHost: true, imapPort: true, imapLogin: true,
      smtpHost: true, smtpPort: true, smtpLogin: true,
      scanNonLuSeulement: true, scanNombre: true,
      instructionSpecifique: true, salonDiscordRapport: true,
      createdAt: true, updatedAt: true
      // imapPassword et smtpPassword exclus de la liste
    }
  })
  res.json(boites)
})

// POST /mail/boites
router.post('/boites', async (req, res) => {
  const {
    nom, email, provider,
    imapHost, imapPort, imapLogin, imapPassword,
    smtpHost, smtpPort, smtpLogin, smtpPassword,
    scanNonLuSeulement, scanNombre,
    instructionSpecifique, salonDiscordRapport
  } = req.body

  if (!nom || !email || !provider) {
    return res.status(400).json({ error: 'nom, email et provider requis' })
  }

  const boite = await prisma.boiteMail.create({
    data: {
      nom, email, provider,
      imapHost: imapHost || '',
      imapPort: imapPort || 993,
      imapLogin: imapLogin || email,
      imapPassword: imapPassword || '',
      smtpHost: smtpHost || '',
      smtpPort: smtpPort || 587,
      smtpLogin: smtpLogin || email,
      smtpPassword: smtpPassword || '',
      scanNonLuSeulement: scanNonLuSeulement !== false,
      scanNombre: scanNombre || 20,
      instructionSpecifique: instructionSpecifique || '',
      salonDiscordRapport: salonDiscordRapport || ''
    }
  })

  logAction(`Mail: boîte créée — ${nom} (${email})`)
  res.status(201).json(boite)
})

// PUT /mail/boites/:id
router.put('/boites/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const {
    nom, email, provider, actif,
    imapHost, imapPort, imapLogin, imapPassword,
    smtpHost, smtpPort, smtpLogin, smtpPassword,
    scanNonLuSeulement, scanNombre,
    instructionSpecifique, salonDiscordRapport
  } = req.body

  const data = {}
  if (nom !== undefined) data.nom = nom
  if (email !== undefined) data.email = email
  if (provider !== undefined) data.provider = provider
  if (actif !== undefined) data.actif = actif
  if (imapHost !== undefined) data.imapHost = imapHost
  if (imapPort !== undefined) data.imapPort = imapPort
  if (imapLogin !== undefined) data.imapLogin = imapLogin
  if (imapPassword !== undefined && imapPassword !== '') data.imapPassword = imapPassword
  if (smtpHost !== undefined) data.smtpHost = smtpHost
  if (smtpPort !== undefined) data.smtpPort = smtpPort
  if (smtpLogin !== undefined) data.smtpLogin = smtpLogin
  if (smtpPassword !== undefined && smtpPassword !== '') data.smtpPassword = smtpPassword
  if (scanNonLuSeulement !== undefined) data.scanNonLuSeulement = scanNonLuSeulement
  if (scanNombre !== undefined) data.scanNombre = scanNombre
  if (instructionSpecifique !== undefined) data.instructionSpecifique = instructionSpecifique
  if (salonDiscordRapport !== undefined) data.salonDiscordRapport = salonDiscordRapport

  const boite = await prisma.boiteMail.update({ where: { id }, data })
  logAction(`Mail: boîte ${id} modifiée`)
  res.json(boite)
})

// DELETE /mail/boites/:id
router.delete('/boites/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  // Supprimer les logs associés d'abord
  await prisma.emailLog.deleteMany({ where: { boiteMailId: id } })
  await prisma.boiteMail.delete({ where: { id } })
  logAction(`Mail: boîte ${id} supprimée`)
  res.status(204).end()
})

// POST /mail/boites/:id/test — teste IMAP + SMTP
router.post('/boites/:id/test', async (req, res) => {
  const id = parseInt(req.params.id)
  const boite = await prisma.boiteMail.findUnique({ where: { id } })
  if (!boite) return res.status(404).json({ error: 'Boîte introuvable' })

  const [imap, smtp] = await Promise.all([
    testConnection(boite),
    testSmtp(boite)
  ])

  res.json({ imap, smtp })
})

// GET /mail/boites/:id/emails — fetch live depuis IMAP (sans analyse EVA)
router.get('/boites/:id/emails', async (req, res) => {
  const id = parseInt(req.params.id)
  const boite = await prisma.boiteMail.findUnique({ where: { id } })
  if (!boite) return res.status(404).json({ error: 'Boîte introuvable' })

  try {
    const emails = await fetchEmails(boite, new Set())
    res.json(emails)
  } catch (err) {
    logError(`Mail fetch live ${boite.email} : ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// GET /mail/boites/:id/dossiers
router.get('/boites/:id/dossiers', async (req, res) => {
  const id = parseInt(req.params.id)
  const boite = await prisma.boiteMail.findUnique({ where: { id } })
  if (!boite) return res.status(404).json({ error: 'Boîte introuvable' })

  try {
    const dossiers = await listerDossiers(boite)
    res.json(dossiers)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── JOURNAL (EmailLog) ───────────────────────────────────────────────────────

// GET /mail/journal?date=2026-03-30&boiteId=1
router.get('/journal', async (req, res) => {
  const { date, boiteId } = req.query

  const where = {}

  if (date) {
    const debut = new Date(date)
    debut.setHours(0, 0, 0, 0)
    const fin = new Date(date)
    fin.setHours(23, 59, 59, 999)
    where.createdAt = { gte: debut, lte: fin }
  }

  if (boiteId) {
    where.boiteMailId = parseInt(boiteId)
  }

  const logs = await prisma.emailLog.findMany({
    where,
    include: { boiteMail: { select: { id: true, nom: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  })

  res.json(logs)
})

// GET /mail/journal/dates — liste les dates pour lesquelles il y a des logs
router.get('/journal/dates', async (req, res) => {
  const logs = await prisma.emailLog.findMany({
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' }
  })

  const dates = [...new Set(
    logs.map(l => l.createdAt.toISOString().split('T')[0])
  )]

  res.json(dates)
})

// ─── BROUILLONS ───────────────────────────────────────────────────────────────

// GET /mail/brouillons — logs EVA avec action=repondre non encore envoyés
router.get('/brouillons', async (req, res) => {
  const brouillons = await prisma.emailLog.findMany({
    where: { action: 'repondre', brouillonEnvoye: false, brouillon: { not: null } },
    include: { boiteMail: { select: { id: true, nom: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(brouillons)
})

// PUT /mail/brouillons/:id — modifier le contenu du brouillon
router.put('/brouillons/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { brouillon } = req.body

  const log = await prisma.emailLog.update({
    where: { id },
    data: { brouillon }
  })
  res.json(log)
})

// POST /mail/brouillons/:id/envoyer — envoyer le brouillon
router.post('/brouillons/:id/envoyer', async (req, res) => {
  const id = parseInt(req.params.id)
  const log = await prisma.emailLog.findUnique({
    where: { id },
    include: { boiteMail: true }
  })
  if (!log) return res.status(404).json({ error: 'Brouillon introuvable' })
  if (log.brouillonEnvoye) return res.status(400).json({ error: 'Déjà envoyé' })

  try {
    await envoyerEmail(log.boiteMail, {
      to: log.expediteur,
      subject: `Re: ${log.sujet}`,
      body: log.brouillon
    })

    const updated = await prisma.emailLog.update({
      where: { id },
      data: { brouillonEnvoye: true, actionAppliquee: true }
    })

    logAction(`Mail: brouillon ${id} envoyé à ${log.expediteur}`)
    res.json(updated)
  } catch (err) {
    logError(`Mail: erreur envoi brouillon ${id} — ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

export default router
