import prisma from '../../config/db.js'

export const rechercheTools = [
  {
    name: 'rechercher_produits',
    category: 'recherche',
    description: 'Recherche des produits du catalogue par nom, catégorie ou auteur',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nom, catégorie ou mot-clé à rechercher' }
      },
      required: ['query']
    },
    async execute({ query }) {
      const produits = await prisma.produit.findMany({
        where: {
          actif: true,
          OR: [
            { nom: { contains: query } },
            { description: { contains: query } },
            { categorie: { nom: { contains: query } } },
            { auteurs: { some: { auteur: { OR: [
              { nom: { contains: query } },
              { prenom: { contains: query } }
            ]}}}}
          ]
        },
        include: {
          categorie: { select: { nom: true } },
          auteurs: { include: { auteur: { select: { nom: true, prenom: true } } } }
        },
        take: 10
      })

      return produits.map(p => ({
        id: p.id,
        nom: p.nom,
        categorie: p.categorie.nom,
        prixTTC: p.prixVenteTTC,
        stock: p.stock,
        stockAlerte: p.stockAlerte,
        stockFaible: p.stock <= p.stockAlerte,
        auteurs: p.auteurs.map(a => `${a.auteur.prenom ?? ''} ${a.auteur.nom}`.trim())
      }))
    }
  },

  {
    name: 'rechercher_auteurs',
    category: 'recherche',
    description: 'Recherche des auteurs par nom ou prénom',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nom ou prénom de l\'auteur' }
      },
      required: ['query']
    },
    async execute({ query }) {
      const auteurs = await prisma.auteur.findMany({
        where: {
          OR: [
            { nom: { contains: query } },
            { prenom: { contains: query } }
          ]
        },
        include: {
          produits: { include: { produit: { select: { nom: true, stock: true } } } }
        },
        take: 10
      })

      return auteurs.map(a => ({
        id: a.id,
        nom: `${a.prenom ?? ''} ${a.nom}`.trim(),
        email: a.email,
        produits: a.produits.map(ap => ({ nom: ap.produit.nom, stock: ap.produit.stock }))
      }))
    }
  },

  {
    name: 'rechercher_sessions',
    category: 'recherche',
    description: 'Recherche des sessions de vente passées par PDV ou période',
    parameters: {
      type: 'object',
      properties: {
        pdv: { type: 'string', description: 'Nom (partiel) du point de vente' },
        debut: { type: 'string', description: 'Date début au format YYYY-MM-DD' },
        fin: { type: 'string', description: 'Date fin au format YYYY-MM-DD' }
      }
    },
    async execute({ pdv, debut, fin }) {
      const where = {}
      if (pdv) where.pointDeVente = { nom: { contains: pdv } }
      if (debut || fin) {
        where.debut = {}
        if (debut) where.debut.gte = new Date(debut)
        if (fin) where.debut.lte = new Date(fin)
      }

      const sessions = await prisma.session.findMany({
        where,
        orderBy: { debut: 'desc' },
        take: 10,
        include: {
          pointDeVente: { select: { nom: true, ville: true } },
          _count: { select: { ventes: true } },
          frais: { select: { montant: true } }
        }
      })

      return sessions.map(s => ({
        id: s.id,
        pdv: `${s.pointDeVente.nom}${s.pointDeVente.ville ? ` (${s.pointDeVente.ville})` : ''}`,
        statut: s.statut,
        debut: s.debut.toLocaleDateString('fr-FR'),
        fin: s.fin ? s.fin.toLocaleDateString('fr-FR') : null,
        nbVentes: s._count.ventes,
        totalFrais: s.frais.reduce((sum, f) => sum + f.montant, 0)
      }))
    }
  },

  {
    name: 'rechercher_pdv',
    category: 'recherche',
    description: 'Recherche des points de vente par nom ou ville',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nom ou ville du point de vente' }
      },
      required: ['query']
    },
    async execute({ query }) {
      const pdvs = await prisma.pointDeVente.findMany({
        where: {
          actif: true,
          OR: [
            { nom: { contains: query } },
            { ville: { contains: query } }
          ]
        },
        include: {
          typePDV: { select: { nom: true } },
          _count: { select: { sessions: true, depots: true } }
        },
        take: 10
      })

      return pdvs.map(p => ({
        id: p.id,
        nom: p.nom,
        ville: p.ville,
        type: p.typePDV.nom,
        commissionPourcent: p.commissionPourcent,
        commissionFixe: p.commissionFixe,
        nbSessions: p._count.sessions,
        nbDepots: p._count.depots
      }))
    }
  }
]
