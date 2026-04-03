import prisma from '../../config/db.js'
import { calcRecapSession, calcRecapCompta } from './ventes.calculs.js'

// ─── PRODUITS ─────────────────────────────────────────────────────────────────

export async function getProduits() {
  return prisma.produit.findMany({
    where: { actif: true },
    include: { categorie: true, auteurs: { include: { auteur: true } } },
    orderBy: { nom: 'asc' },
  })
}

export async function getProduitById(id) {
  return prisma.produit.findUnique({
    where: { id },
    include: { categorie: true, auteurs: { include: { auteur: true } } },
  })
}

export async function createProduit(data) {
  const { auteurIds, ...rest } = data
  return prisma.produit.create({
    data: {
      ...rest,
      auteurs: auteurIds ? {
        create: auteurIds.map(id => ({ auteurId: id }))
      } : undefined,
    },
  })
}

export async function updateProduit(id, data) {
  const { auteurIds, ...rest } = data
  return prisma.produit.update({
    where: { id },
    data: rest,
  })
}

export async function deleteProduit(id) {
  return prisma.produit.update({
    where: { id },
    data: { actif: false },
  })
}

export async function updateImageProduit(id, imageUrl) {
  return prisma.produit.update({
    where: { id },
    data: { imageUrl },
  })
}

// ─── STOCK ────────────────────────────────────────────────────────────────────

export async function updateStock(produitId, delta) {
  return prisma.produit.update({
    where: { id: produitId },
    data: { stock: { increment: delta } },
  })
}

export async function getEtatStock(produitId) {
  const produit = await prisma.produit.findUnique({ where: { id: produitId } })
  const horsStock = await prisma.mouvementHorsStock.aggregate({
    where: { produitId },
    _sum: { quantite: true },
  })
  const depots = await prisma.depot.aggregate({
    where: { produitId, actif: true },
    _sum: { quantite: true },
  })
  const pertes = await prisma.perte.aggregate({
    where: { produitId },
    _sum: { quantite: true },
  })
  return {
    disponible: produit.stock,
    horsStock: horsStock._sum.quantite || 0,
    enDepot: depots._sum.quantite || 0,
    pertes: pertes._sum.quantite || 0,
  }
}

// ─── POINTS DE VENTE ──────────────────────────────────────────────────────────

export async function getPointsDeVente() {
  return prisma.pointDeVente.findMany({
    where: { actif: true },
    include: { typePDV: true, contact: true },
    orderBy: { nom: 'asc' },
  })
}

export async function createPointDeVente(data) {
  return prisma.pointDeVente.create({ data })
}

export async function updatePointDeVente(id, data) {
  return prisma.pointDeVente.update({ where: { id }, data })
}

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

export async function ouvrirSession(pointDeVenteId, debut) {
  return prisma.session.create({
    data: {
      pointDeVenteId,
      debut: debut ? new Date(debut) : new Date(),
      statut: 'ouverte',
    },
  })
}

export async function cloturerSession(sessionId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      pointDeVente: true,
      frais: true,
      ventes: {
        include: {
          lignes: { include: { produit: true } },
        },
      },
    },
  })

  if (!session) throw new Error('Session introuvable')
  if (session.statut === 'cloturee') throw new Error('Session déjà clôturée')

  const recap = calcRecapSession(session)

  await prisma.session.update({
    where: { id: sessionId },
    data: { statut: 'cloturee', fin: new Date() },
  })

  return recap
}

export async function supprimerSession(id) {
  const session = await prisma.session.findUnique({
    where: { id },
    include: { ventes: { include: { lignes: true } } },
  })
  if (!session) throw new Error('Session introuvable')

  // Restaurer le stock pour les ventes non annulées
  for (const vente of session.ventes) {
    if (!vente.annulee) {
      for (const ligne of vente.lignes) {
        await updateStock(ligne.produitId, ligne.quantite)
      }
    }
  }

  const venteIds = session.ventes.map(v => v.id)
  await prisma.ligneVente.deleteMany({ where: { venteId: { in: venteIds } } })
  await prisma.vente.deleteMany({ where: { sessionId: id } })
  await prisma.frais.deleteMany({ where: { sessionId: id } })
  await prisma.session.delete({ where: { id } })
}

export async function getSessions({ limit = 20, offset = 0 } = {}) {
  return prisma.session.findMany({
    include: {
      pointDeVente: true,
      ventes: {
        include: { lignes: { include: { produit: true } } },
      },
      frais: true,
    },
    orderBy: { debut: 'desc' },
    take: limit,
    skip: offset,
  })
}

export async function getSessionById(id) {
  return prisma.session.findUnique({
    where: { id },
    include: {
      pointDeVente: true,
      frais: { include: { typeFrais: true } },
      ventes: {
        include: {
          lignes: { include: { produit: true } },
          methodePaiement: true,
        },
      },
    },
  })
}

// ─── VENTES ───────────────────────────────────────────────────────────────────

export async function enregistrerVente(data) {
  const { sessionId, methodePaiementId, type, lignes } = data

  const vente = await prisma.vente.create({
    data: {
      sessionId: sessionId || null,
      methodePaiementId: methodePaiementId || null,
      type: type || 'session',
      lignes: {
        create: lignes.map(l => ({
          produitId: l.produitId,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          remise: l.remise || 0,
        })),
      },
    },
    include: { lignes: true },
  })

  for (const l of lignes) {
    await updateStock(l.produitId, -l.quantite)
  }

  return vente
}

export async function annulerVente(venteId) {
  const vente = await prisma.vente.findUnique({
    where: { id: venteId },
    include: { lignes: true },
  })

  if (!vente) throw new Error('Vente introuvable')
  if (vente.annulee) throw new Error('Vente déjà annulée')

  for (const l of vente.lignes) {
    await updateStock(l.produitId, l.quantite)
  }

  return prisma.vente.update({
    where: { id: venteId },
    data: { annulee: true },
  })
}

// ─── FRAIS ────────────────────────────────────────────────────────────────────

export async function getFrais({ debut, fin } = {}) {
  const where = {}
  if (debut || fin) {
    where.createdAt = {}
    if (debut) where.createdAt.gte = new Date(debut)
    if (fin) where.createdAt.lte = new Date(fin)
  }
  return prisma.frais.findMany({
    where,
    include: { typeFrais: true, session: { include: { pointDeVente: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function ajouterFraisSession(sessionId, data) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Session introuvable')
  if (session.statut === 'cloturee') throw new Error('Session déjà clôturée')
  return prisma.frais.create({
    data: {
      typeFraisId: data.typeFraisId,
      libelle: data.libelle,
      montant: data.montant,
      sessionId,
    },
    include: { typeFrais: true },
  })
}

export async function ajouterFraisLibre(data) {
  return prisma.frais.create({
    data: {
      typeFraisId: data.typeFraisId,
      libelle: data.libelle,
      montant: data.montant,
      sessionId: null,
    },
    include: { typeFrais: true },
  })
}

export async function supprimerFrais(id) {
  return prisma.frais.delete({ where: { id } })
}

// ─── PERTES ───────────────────────────────────────────────────────────────────

export async function getPertes({ debut, fin } = {}) {
  const where = {}
  if (debut || fin) {
    where.createdAt = {}
    if (debut) where.createdAt.gte = new Date(debut)
    if (fin) where.createdAt.lte = new Date(fin)
  }
  return prisma.perte.findMany({
    where,
    include: { typePerte: true, produit: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function creerPerte(data) {
  const perte = await prisma.perte.create({
    data: {
      typePerteid: data.typePerteid,
      produitId: data.produitId || null,
      quantite: data.quantite || null,
      valeur: data.valeur,
      description: data.description || null,
    },
    include: { typePerte: true, produit: true },
  })

  if (perte.produitId && perte.quantite) {
    await updateStock(perte.produitId, -perte.quantite)
  }

  return perte
}

export async function supprimerPerte(id) {
  const perte = await prisma.perte.findUnique({ where: { id } })
  if (!perte) throw new Error('Perte introuvable')

  await prisma.perte.delete({ where: { id } })

  // Restituer le stock si la perte était liée à un produit
  if (perte.produitId && perte.quantite) {
    await updateStock(perte.produitId, perte.quantite)
  }
}

// ─── AUTEURS ──────────────────────────────────────────────────────────────────

export async function getAuteurs() {
  return prisma.auteur.findMany({ orderBy: { nom: 'asc' } })
}

export async function creerAuteur(data) {
  return prisma.auteur.create({ data: { nom: data.nom, prenom: data.prenom || null, email: data.email || null } })
}

export async function updateAuteur(id, data) {
  return prisma.auteur.update({
    where: { id },
    data: { nom: data.nom, prenom: data.prenom || null, email: data.email || null },
  })
}

export async function supprimerAuteur(id) {
  return prisma.auteur.delete({ where: { id } })
}

export async function setAuteursProduit(produitId, auteurIds) {
  await prisma.auteurProduit.deleteMany({ where: { produitId } })
  if (auteurIds?.length) {
    await prisma.auteurProduit.createMany({
      data: auteurIds.map(auteurId => ({ produitId, auteurId })),
    })
  }
  return prisma.produit.findUnique({
    where: { id: produitId },
    include: { auteurs: { include: { auteur: true } } },
  })
}

// ─── DÉPÔTS ───────────────────────────────────────────────────────────────────

export async function getDepots({ pdvId } = {}) {
  return prisma.depot.findMany({
    where: pdvId ? { pointDeVenteId: pdvId } : {},
    include: {
      produit: true,
      pointDeVente: true,
    },
    orderBy: { dateDepot: 'desc' },
  })
}

export async function creerDepot(data) {
  const depot = await prisma.depot.create({
    data: {
      produitId: data.produitId,
      pointDeVenteId: data.pointDeVenteId,
      quantite: data.quantite,
      notes: data.notes || null,
    },
    include: { produit: true, pointDeVente: true },
  })

  await updateStock(depot.produitId, -depot.quantite)

  return depot
}

export async function retourDepot(depotId, quantiteRetour) {
  const depot = await prisma.depot.findUnique({ where: { id: depotId } })
  if (!depot) throw new Error('Dépôt introuvable')
  if (!depot.actif) throw new Error('Dépôt déjà clôturé')
  if (quantiteRetour > depot.quantite) throw new Error('Quantité de retour supérieure au dépôt')

  const retourTotal = quantiteRetour === depot.quantite

  // Remettre le stock
  await updateStock(depot.produitId, quantiteRetour)

  if (retourTotal) {
    return prisma.depot.update({
      where: { id: depotId },
      data: { actif: false, dateRetour: new Date() },
      include: { produit: true, pointDeVente: true },
    })
  } else {
    return prisma.depot.update({
      where: { id: depotId },
      data: { quantite: depot.quantite - quantiteRetour },
      include: { produit: true, pointDeVente: true },
    })
  }
}

// ─── COMPTABILITÉ ─────────────────────────────────────────────────────────────

export async function getRecapCompta({ debut, fin } = {}) {
  const filtreDates = {}
  if (debut || fin) {
    filtreDates.debut = {}
    if (debut) filtreDates.debut.gte = new Date(debut)
    if (fin) filtreDates.debut.lte = new Date(fin)
  }

  const sessionsCloturees = await prisma.session.findMany({
    where: { statut: 'cloturee', ...filtreDates },
    include: {
      pointDeVente: true,
      frais: true,
      ventes: { include: { lignes: { include: { produit: true } } } },
    },
    orderBy: { debut: 'desc' },
  })

  const fraisHorsSessions = await prisma.frais.findMany({
    where: {
      sessionId: null,
      ...(debut || fin ? {
        createdAt: {
          ...(debut ? { gte: new Date(debut) } : {}),
          ...(fin ? { lte: new Date(fin) } : {}),
        }
      } : {}),
    },
    include: { typeFrais: true },
  })

  const pertes = await prisma.perte.findMany({
    where: debut || fin ? {
      createdAt: {
        ...(debut ? { gte: new Date(debut) } : {}),
        ...(fin ? { lte: new Date(fin) } : {}),
      }
    } : {},
    include: { typePerte: true, produit: true },
  })

  const recap = calcRecapCompta(sessionsCloturees, fraisHorsSessions, pertes)

  return {
    recap,
    sessions: sessionsCloturees,
    fraisHorsSessions,
    pertes,
  }
}