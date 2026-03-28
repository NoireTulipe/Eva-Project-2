import prisma from '../../config/db.js'
import { calcRecapSession } from './ventes.calculs.js'

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