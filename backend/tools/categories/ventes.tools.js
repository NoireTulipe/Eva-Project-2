import prisma from '../../config/db.js'

export const ventesTools = [
  {
    name: 'get_produits',
    category: 'ventes',
    description: 'Liste les produits du catalogue avec leur stock actuel',
    parameters: {
      type: 'object',
      properties: {
        actif: { type: 'boolean', description: 'Filtrer sur les produits actifs uniquement (défaut true)' }
      }
    },
    async execute({ actif = true }) {
      const produits = await prisma.produit.findMany({
        where: { actif },
        include: { categorie: true },
        orderBy: { nom: 'asc' }
      })
      return produits.map(p => ({
        id: p.id,
        nom: p.nom,
        categorie: p.categorie.nom,
        prix: p.prixVenteTTC,
        stock: p.stock,
        stockAlerte: p.stockAlerte,
        alerte: p.stock <= p.stockAlerte
      }))
    }
  },

  {
    name: 'get_session_active',
    category: 'ventes',
    description: 'Retourne la session de vente actuellement ouverte avec son récapitulatif (CA, nb ventes, frais)',
    parameters: {
      type: 'object',
      properties: {}
    },
    async execute() {
      const session = await prisma.session.findFirst({
        where: { statut: 'ouverte' },
        include: {
          pointDeVente: true,
          ventes: { include: { lignes: true } },
          frais: true
        }
      })

      if (!session) return { active: false }

      const ventesValides = session.ventes.filter(v => !v.annulee)
      const ca = ventesValides.reduce(
        (sum, v) => sum + v.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0),
        0
      )
      const totalFrais = session.frais.reduce((s, f) => s + f.montant, 0)

      return {
        active: true,
        id: session.id,
        pdv: session.pointDeVente.nom,
        debut: session.debut,
        nbVentes: ventesValides.length,
        ca: Math.round(ca * 100) / 100,
        frais: Math.round(totalFrais * 100) / 100
      }
    }
  },

  {
    name: 'get_stock_alertes',
    category: 'ventes',
    description: 'Liste les produits en rupture de stock ou sous le seuil d\'alerte',
    parameters: {
      type: 'object',
      properties: {}
    },
    async execute() {
      const produits = await prisma.produit.findMany({
        where: { actif: true },
        orderBy: { stock: 'asc' }
      })
      return produits
        .filter(p => p.stock <= p.stockAlerte)
        .map(p => ({
          nom: p.nom,
          stock: p.stock,
          seuil: p.stockAlerte,
          rupture: p.stock === 0
        }))
    }
  }
]
