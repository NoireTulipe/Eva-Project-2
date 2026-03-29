import prisma from '../../config/db.js'
import { rechercheMemoire, rechercheBuffer } from '../../modules/memoire/recherche.js'

export const memoireTools = [
  {
    name: 'remember_info',
    category: 'memoire',
    description: 'Mémorise une information partagée par l\'utilisateur (fait personnel, préférence, note)',
    parameters: {
      type: 'object',
      properties: {
        contenu: { type: 'string', description: 'L\'information à mémoriser, reformulée clairement' }
      },
      required: ['contenu']
    },
    async execute({ contenu }, context) {
      await prisma.memBuffer.create({
        data: {
          source: `web:${context.userId}`,
          contenu
        }
      })
      return { ok: true, message: 'Information mémorisée' }
    }
  },

  {
    name: 'recall_info',
    category: 'memoire',
    description: 'Recherche des informations mémorisées sur un sujet ou une personne',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Le sujet ou mot-clé à rechercher dans la mémoire' }
      },
      required: ['query']
    },
    async execute({ query }, context) {
      const [semantique, buffer] = await Promise.all([
        rechercheMemoire(query, context.userId),
        rechercheBuffer(query, context.userId)
      ])

      return {
        memoire_semantique: semantique.map(r => ({
          type: r.type,
          contenu: r.contenu,
          ...(r.nom && { nom: r.nom }),
          ...(r.cle && { cle: r.cle })
        })),
        buffer_recent: buffer.map(r => r.contenu)
      }
    }
  }
]
