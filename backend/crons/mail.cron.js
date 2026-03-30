import prisma from '../config/db.js'
import { fetchEmails } from '../modules/mail/imap.service.js'
import { analyserEtAgir } from '../modules/mail/mail.eva.js'
import { logAction, logError } from '../logs/logger.js'

/**
 * Lance le scan et l'analyse EVA pour toutes les boîtes mail actives.
 * Appelé par le cron.manager ou manuellement depuis l'admin.
 */
export async function scannerTousLesMails() {
  const boites = await prisma.boiteMail.findMany({ where: { actif: true } })

  if (!boites.length) {
    logAction('Mail cron: aucune boîte active')
    return { traites: 0, boites: 0 }
  }

  logAction(`Mail cron: scan de ${boites.length} boîte(s)`)
  let totalTraites = 0

  for (const boite of boites) {
    try {
      // Récupérer les UIDs déjà traités pour cette boîte (depuis EmailLog)
      const logsExistants = await prisma.emailLog.findMany({
        where: { boiteMailId: boite.id, uid: { not: null } },
        select: { uid: true }
      })
      const uidsDejaTraites = new Set(logsExistants.map(l => l.uid))

      // Fetch des nouveaux emails
      const emails = await fetchEmails(boite, uidsDejaTraites)

      if (!emails.length) {
        logAction(`Mail cron: ${boite.email} — aucun nouveau mail`)
        continue
      }

      logAction(`Mail cron: ${boite.email} — ${emails.length} mail(s) à traiter`)

      // Analyser chaque email
      for (const email of emails) {
        try {
          await analyserEtAgir(boite, email)
          totalTraites++
        } catch (err) {
          logError(`Mail cron: erreur analyse email UID ${email.uid} (${boite.email}) — ${err.message}`)
        }
      }

      // Envoyer le rapport Discord si un salon est configuré
      if (boite.salonDiscordRapport) {
        await envoyerRapportDiscord(boite, emails.length)
      }

    } catch (err) {
      logError(`Mail cron: erreur scan ${boite.email} — ${err.message}`)
    }
  }

  logAction(`Mail cron: terminé — ${totalTraites} mail(s) traité(s)`)
  return { traites: totalTraites, boites: boites.length }
}

/**
 * Envoie un résumé du journal du jour dans le salon Discord de la boîte.
 */
async function envoyerRapportDiscord(boite, nbNouveaux) {
  try {
    // Import dynamique pour éviter les dépendances circulaires
    const { envoyerMessageDiscord } = await import('../discord/bot.js')

    const debut = new Date()
    debut.setHours(0, 0, 0, 0)

    const logs = await prisma.emailLog.findMany({
      where: {
        boiteMailId: boite.id,
        createdAt: { gte: debut }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!logs.length) return

    const lignes = logs.map(l =>
      `• **${l.sujet || '(sans sujet)'}** — de ${l.expediteur || '?'}\n  → ${l.action} (${l.categorie}) : ${l.raison}`
    )

    const message = `📬 **Rapport mail — ${boite.nom}** (${new Date().toLocaleDateString('fr-FR')})\n${nbNouveaux} nouveau(x) mail(s) traité(s)\n\n${lignes.join('\n\n')}`

    await envoyerMessageDiscord(boite.salonDiscordRapport, message)
  } catch (err) {
    logError(`Mail cron: erreur rapport Discord ${boite.email} — ${err.message}`)
  }
}
