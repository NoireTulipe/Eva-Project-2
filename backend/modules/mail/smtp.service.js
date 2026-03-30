import nodemailer from 'nodemailer'
import { logAction, logError } from '../../logs/logger.js'

// ─── OAuth2 Microsoft ─────────────────────────────────────────────────────────

async function getMicrosoftAccessToken(refreshToken) {
  const clientId     = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET
  const tenantId     = process.env.AZURE_TENANT_ID || 'common'

  if (!clientId || !clientSecret) {
    throw new Error('AZURE_CLIENT_ID ou AZURE_CLIENT_SECRET manquant dans .env')
  }

  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('scope', 'https://outlook.office.com/SMTP.Send offline_access')
  params.append('refresh_token', refreshToken)
  params.append('grant_type', 'refresh_token')
  params.append('client_secret', clientSecret)

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Azure OAuth2 SMTP : ${data.error} — ${data.error_description}`)
  }

  return data.access_token
}

// ─── Build transport ──────────────────────────────────────────────────────────

async function buildTransport(boite) {
  const isMicrosoft = boite.provider === 'outlook' ||
                      boite.smtpHost.toLowerCase().includes('outlook') ||
                      boite.smtpHost.toLowerCase().includes('office365')

  if (isMicrosoft) {
    // Outlook : OAuth2 obligatoire — smtpPassword contient le refresh token
    const accessToken = await getMicrosoftAccessToken(boite.smtpPassword)

    return nodemailer.createTransport({
      host: boite.smtpHost,
      port: boite.smtpPort,
      secure: false,
      auth: {
        type: 'OAuth2',
        user: boite.smtpLogin,
        accessToken
      },
      tls: { rejectUnauthorized: false }
    })
  }

  // Gmail et autres : mot de passe d'application classique
  return nodemailer.createTransport({
    host: boite.smtpHost,
    port: boite.smtpPort,
    secure: boite.smtpPort === 465,
    auth: {
      user: boite.smtpLogin,
      pass: boite.smtpPassword
    },
    tls: { rejectUnauthorized: false }
  })
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function envoyerEmail(boite, mail) {
  const transport = await buildTransport(boite)

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

export async function testSmtp(boite) {
  try {
    const transport = await buildTransport(boite)
    await transport.verify()
    return { success: true, message: 'Connexion SMTP réussie' }
  } catch (error) {
    logError(`SMTP test ${boite.email} : ${error.message}`)
    return { success: false, message: error.message }
  }
}
