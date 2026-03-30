import { ImapFlow } from 'imapflow'
import { logError, logAction } from '../../logs/logger.js'

// ─── Configuration IMAP ───────────────────────────────────────────────────────

function buildImapConfig(boite) {
  const hostLower = boite.imapHost.toLowerCase()
  const isMicrosoft = hostLower.includes('outlook') ||
                      hostLower.includes('office365') ||
                      boite.imapLogin.toLowerCase().includes('hotmail') ||
                      boite.provider === 'outlook'

  const config = {
    host: boite.imapHost,
    port: boite.imapPort,
    secure: boite.imapPort === 993,
    auth: {
      user: boite.imapLogin,
      pass: boite.imapPassword
    },
    forceIPv4: true,
    logger: false,
    disableCompression: true,
    tls: {
      servername: boite.imapHost,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  }

  // Microsoft : forcer LOGIN (mot de passe d'application)
  if (isMicrosoft) {
    config.authMethod = 'LOGIN'
    config.greetingTimeout = 30000
    config.connectionTimeout = 30000
  }

  return config
}

// ─── Test de connexion ────────────────────────────────────────────────────────

export async function testConnection(boite) {
  const client = new ImapFlow(buildImapConfig(boite))
  try {
    await client.connect()
    await client.logout()
    return { success: true, message: 'Connexion réussie' }
  } catch (error) {
    const msg = error.response?.text || error.message
    logError(`IMAP test connexion ${boite.email} : ${msg}`)
    return { success: false, message: msg }
  }
}

// ─── Fetch emails ─────────────────────────────────────────────────────────────

/**
 * Récupère les emails selon la config de la boîte.
 * Retourne uniquement les mails dont l'UID n'est pas dans `uidsDejaTraites`.
 */
export async function fetchEmails(boite, uidsDejaTraites = new Set()) {
  const client = new ImapFlow(buildImapConfig(boite))
  const emails = []

  try {
    await client.connect()
    const mailbox = await client.mailboxOpen('INBOX')
    const total = mailbox.exists

    if (!total) {
      await client.logout()
      return []
    }

    // Critères de recherche
    const searchCriteria = boite.scanNonLuSeulement ? ['UNSEEN'] : ['ALL']
    const uids = await client.search(searchCriteria, { uid: true })

    if (!uids.length) {
      await client.logout()
      return []
    }

    // Prendre les N derniers UIDs non encore traités
    const nouveauxUids = uids
      .filter(uid => !uidsDejaTraites.has(uid))
      .slice(-boite.scanNombre)

    if (!nouveauxUids.length) {
      await client.logout()
      return []
    }

    const uidRange = nouveauxUids.join(',')
    const messages = await client.fetch(uidRange, {
      envelope: true,
      uid: true,
      bodyStructure: true,
      flags: true
    }, { uid: true })

    const msgList = []
    for await (const m of messages) { msgList.push(m) }

    for (const msg of msgList) {
      let bodyText = ''
      let partId = '1'

      if (msg.bodyStructure) {
        const bs = msg.bodyStructure
        const textPart = bs.childNodes
          ? (bs.childNodes.find(p => p.type === 'text/plain') || bs.childNodes.find(p => p.type === 'text/html'))
          : bs
        partId = textPart?.part || '1'
      }

      try {
        const { content } = await Promise.race([
          client.download(msg.uid, partId, { uid: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ])

        const chunks = []
        for await (const chunk of content) { chunks.push(chunk) }
        bodyText = Buffer.concat(chunks).toString('utf-8')

        // Nettoyer HTML basique
        if (bodyText.includes('<html') || bodyText.includes('<div')) {
          bodyText = bodyText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim()
        }
      } catch {
        bodyText = '(Contenu non récupérable)'
      }

      emails.push({
        uid: msg.uid,
        sujet: msg.envelope.subject || '(pas de sujet)',
        expediteur: msg.envelope.from?.[0]?.address || 'Inconnu',
        expediteurNom: msg.envelope.from?.[0]?.name || '',
        replyTo: msg.envelope.replyTo?.[0]?.address || msg.envelope.from?.[0]?.address || '',
        date: msg.envelope.date,
        corps: bodyText.substring(0, 800),
        dossier: 'INBOX',
        isRead: msg.flags ? [...msg.flags].includes('\\Seen') : false
      })
    }

    await client.logout()
    return emails

  } catch (error) {
    logError(`IMAP fetch ${boite.email} : ${error.message}`)
    try { await client.logout() } catch {}
    throw error
  }
}

// ─── Actions IMAP ─────────────────────────────────────────────────────────────

export async function supprimerEmail(boite, uid) {
  const client = new ImapFlow(buildImapConfig(boite))
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')

    const list = await client.list()
    const trash = list.find(f =>
      f.specialUse === '\\Trash' ||
      f.name.toLowerCase().includes('trash') ||
      f.name.toLowerCase().includes('corbeille') ||
      f.name.toLowerCase().includes('deleted')
    )
    const dest = trash ? trash.path : '[Gmail]/Trash'

    await client.messageMove([uid], dest, { uid: true })
    logAction(`IMAP: email UID ${uid} déplacé vers ${dest} (${boite.email})`)
    await client.logout()
    return { success: true }
  } catch (error) {
    logError(`IMAP suppression ${boite.email} UID ${uid} : ${error.message}`)
    try { await client.logout() } catch {}
    throw error
  }
}

export async function archiverEmail(boite, uid) {
  const client = new ImapFlow(buildImapConfig(boite))
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')

    const list = await client.list()
    const archive = list.find(f =>
      f.specialUse === '\\Archive' ||
      f.name === 'Archives' ||
      f.name.toLowerCase() === 'archive' ||
      f.name === '[Gmail]/Tous les messages' ||
      f.name === '[Gmail]/All Mail'
    )

    if (archive) {
      await client.messageMove([uid], archive.path, { uid: true })
      logAction(`IMAP: email UID ${uid} archivé dans ${archive.path} (${boite.email})`)
    } else {
      await client.messageFlagsAdd([uid], ['\\Seen'], { uid: true })
      logAction(`IMAP: email UID ${uid} marqué lu (pas d'archive) (${boite.email})`)
    }

    await client.logout()
    return { success: true }
  } catch (error) {
    logError(`IMAP archivage ${boite.email} UID ${uid} : ${error.message}`)
    try { await client.logout() } catch {}
    throw error
  }
}

export async function deplacerEmail(boite, uid, dossierCible) {
  const client = new ImapFlow(buildImapConfig(boite))
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    await client.messageMove([uid], dossierCible, { uid: true })
    logAction(`IMAP: email UID ${uid} déplacé vers ${dossierCible} (${boite.email})`)
    await client.logout()
    return { success: true }
  } catch (error) {
    logError(`IMAP déplacement ${boite.email} UID ${uid} : ${error.message}`)
    try { await client.logout() } catch {}
    throw error
  }
}

export async function marquerLu(boite, uid) {
  const client = new ImapFlow(buildImapConfig(boite))
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    await client.messageFlagsAdd([uid], ['\\Seen'], { uid: true })
    await client.logout()
    return { success: true }
  } catch (error) {
    logError(`IMAP marquer lu ${boite.email} UID ${uid} : ${error.message}`)
    try { await client.logout() } catch {}
    throw error
  }
}

export async function listerDossiers(boite) {
  const client = new ImapFlow(buildImapConfig(boite))
  try {
    await client.connect()
    const list = await client.list()
    await client.logout()
    return list.map(f => ({ path: f.path, name: f.name, specialUse: f.specialUse || null }))
  } catch (error) {
    logError(`IMAP liste dossiers ${boite.email} : ${error.message}`)
    try { await client.logout() } catch {}
    throw error
  }
}
