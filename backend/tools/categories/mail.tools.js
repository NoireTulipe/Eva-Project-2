import prisma from '../../config/db.js'
import { fetchEmails } from '../../modules/mail/imap.service.js'
import { envoyerEmail } from '../../modules/mail/smtp.service.js'

export const mailTools = [
  {
    name: 'lire_mails',
    category: 'mail',
    description: 'Lit les derniers emails d\'une boîte mail. Retourne sujet, expéditeur, résumé du corps.',
    parameters: {
      boiteId: { type: 'number', description: 'ID de la boîte mail (optionnel — toutes les boîtes si absent)' },
      nombre: { type: 'number', description: 'Nombre de mails à lire (défaut : 5)' }
    },
    async execute({ boiteId, nombre = 5 }, context) {
      let boites
      if (boiteId) {
        const b = await prisma.boiteMail.findUnique({ where: { id: boiteId } })
        boites = b ? [b] : []
      } else {
        boites = await prisma.boiteMail.findMany({ where: { actif: true } })
      }

      if (!boites.length) return { erreur: 'Aucune boîte mail configurée' }

      const resultats = []
      for (const boite of boites) {
        try {
          const overrideBoite = { ...boite, scanNombre: nombre, scanNonLuSeulement: false }
          const emails = await fetchEmails(overrideBoite, new Set())
          resultats.push({
            boite: boite.nom,
            email: boite.email,
            mails: emails.map(e => ({
              uid: e.uid,
              sujet: e.sujet,
              de: e.expediteur,
              date: e.date,
              apercu: e.corps?.substring(0, 200)
            }))
          })
        } catch (err) {
          resultats.push({ boite: boite.nom, erreur: err.message })
        }
      }

      return resultats
    }
  },

  {
    name: 'envoyer_mail',
    category: 'mail',
    description: 'Envoie un email depuis une boîte configurée.',
    parameters: {
      boiteId: { type: 'number', description: 'ID de la boîte mail expéditrice' },
      to: { type: 'string', description: 'Adresse email du destinataire' },
      sujet: { type: 'string', description: 'Sujet du mail' },
      corps: { type: 'string', description: 'Corps du mail (texte)' }
    },
    async execute({ boiteId, to, sujet, corps }, context) {
      if (!boiteId || !to || !sujet || !corps) {
        return { erreur: 'boiteId, to, sujet et corps requis' }
      }

      const boite = await prisma.boiteMail.findUnique({ where: { id: boiteId } })
      if (!boite) return { erreur: 'Boîte mail introuvable' }

      // Créer un brouillon dans EmailLog (l'envoi réel se fait depuis l'interface)
      const log = await prisma.emailLog.create({
        data: {
          boiteMailId: boite.id,
          sujet,
          expediteur: to,
          categorie: 'sortant',
          action: 'repondre',
          raison: 'Rédigé par EVA via conversation',
          brouillon: corps,
          brouillonEnvoye: false
        }
      })

      return {
        message: 'Brouillon créé. Il est visible dans le journal mail pour envoi.',
        logId: log.id,
        destinataire: to,
        sujet
      }
    }
  },

  {
    name: 'journal_mail',
    category: 'mail',
    description: 'Consulte le journal des actions mail d\'EVA pour une date donnée.',
    parameters: {
      date: { type: 'string', description: 'Date au format YYYY-MM-DD (défaut : aujourd\'hui)' }
    },
    async execute({ date }, context) {
      const targetDate = date ? new Date(date) : new Date()
      const debut = new Date(targetDate)
      debut.setHours(0, 0, 0, 0)
      const fin = new Date(targetDate)
      fin.setHours(23, 59, 59, 999)

      const logs = await prisma.emailLog.findMany({
        where: { createdAt: { gte: debut, lte: fin } },
        include: { boiteMail: { select: { nom: true } } },
        orderBy: { createdAt: 'desc' }
      })

      return logs.map(l => ({
        boite: l.boiteMail.nom,
        sujet: l.sujet,
        expediteur: l.expediteur,
        categorie: l.categorie,
        action: l.action,
        raison: l.raison,
        heure: l.createdAt.toLocaleTimeString('fr-FR')
      }))
    }
  }
]
