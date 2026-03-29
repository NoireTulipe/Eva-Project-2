import prisma from '../../config/db.js'

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
      const [buffer, souvenirs, preferences] = await Promise.all([
        prisma.memBuffer.findMany({
          where: {
            source: { startsWith: `web:${context.userId}` },
            contenu: { contains: query }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        }),
        prisma.memSouvenir.findMany({
          where: {
            userId: context.userId,
            contenu: { contains: query }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        }),
        prisma.memPreference.findMany({
          where: {
            userId: context.userId,
            contenu: { contains: query }
          },
          orderBy: { createdAt: 'desc' },
          take: 3
        })
      ])

      return {
        buffer: buffer.map(r => r.contenu),
        souvenirs: souvenirs.map(s => s.contenu),
        preferences: preferences.map(p => ({ cle: p.cle, contenu: p.contenu }))
      }
    }
  }
]
