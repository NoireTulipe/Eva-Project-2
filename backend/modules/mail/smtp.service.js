import nodemailer from 'nodemailer'
import { logAction, logError } from '../../logs/logger.js'

function buildTransport(boite) {
  return nodemailer.createTransport({
    host: boite.smtpHost,
    port: boite.smtpPort,
    secure: boite.smtpPort === 465,
    auth: {
      user: boite.smtpLogin,
      pass: boite.smtpPassword
    },
    tls: {
      rejectUnauthorized: false
    }
  })
}

/**
 * Envoie un email via SMTP.
 * @param {object} boite - BoiteMail complet
 * @param {object} mail  - { to, subject, body, replyToMessageId? }
 */
export async function envoyerEmail(boite, mail) {
  const transport = buildTransport(boite)

  const options = {
    from: `"${boite.nom}" <${boite.email}>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.body
  }

  if (mail.replyToMessageId) {
    options.inReplyTo = mail.replyToMessageId
    options.references = mail.replyToMessageId
  }

  try {
    const info = await transport.sendMail(options)
    logAction(`SMTP: email envoyé depuis ${boite.email} vers ${mail.to} — "${mail.subject}"`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    logError(`SMTP envoi ${boite.email} : ${error.message}`)
    throw error
  }
}

/**
 * Teste la connexion SMTP.
 */
export async function testSmtp(boite) {
  const transport = buildTransport(boite)
  try {
    await transport.verify()
    return { success: true, message: 'Connexion SMTP réussie' }
  } catch (error) {
    logError(`SMTP test ${boite.email} : ${error.message}`)
    return { success: false, message: error.message }
  }
}
