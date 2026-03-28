/**
 * Fixtures de test — Maison d'Édition
 * Lance avec : npm run seed:fixtures (depuis backend/)
 *
 * Crée :
 *  - 3 auteurs
 *  - 6 produits (livres + goodies) liés aux auteurs
 *  - 3 points de vente
 *  - 2 sessions clôturées avec ventes + frais
 *  - 1 session ouverte avec ventes en cours
 *  - 2 dépôts actifs chez des PDV
 *  - 1 perte déclarée
 *  - 1 frais hors session
 */

import dotenv from 'dotenv'
import prisma from '../config/db.js'

dotenv.config({ path: '../.env' })

async function main() {
  console.log('Chargement des fixtures...')

  // ─── Auteurs ─────────────────────────────────────────────────────────────────

  const auteur1 = await prisma.auteur.upsert({
    where: { id: 1 },
    update: {},
    create: { nom: 'Dupont', prenom: 'Marie', email: 'marie.dupont@example.com' },
  })

  const auteur2 = await prisma.auteur.upsert({
    where: { id: 2 },
    update: {},
    create: { nom: 'Martin', prenom: 'Luc', email: 'luc.martin@example.com' },
  })

  const auteur3 = await prisma.auteur.upsert({
    where: { id: 3 },
    update: {},
    create: { nom: 'Bernard', prenom: 'Claire' },
  })

  console.log('Auteurs créés')

  // ─── Références utiles ────────────────────────────────────────────────────────

  const catRoman    = await prisma.categorie.findFirst({ where: { nom: 'Roman' } })
  const catNouvelle = await prisma.categorie.findFirst({ where: { nom: 'Nouvelle' } })
  const catPoesie   = await prisma.categorie.findFirst({ where: { nom: 'Poésie' } })
  const catGoodie   = await prisma.categorie.findFirst({ where: { nom: 'Goodie' } })

  const typeSalon   = await prisma.typePDV.findFirst({ where: { nom: 'Salon du livre' } })
  const typeLib     = await prisma.typePDV.findFirst({ where: { nom: 'Librairie' } })
  const typeFestival = await prisma.typePDV.findFirst({ where: { nom: 'Festival' } })

  const paiEspeces  = await prisma.methodePaiement.findFirst({ where: { nom: 'Espèces' } })
  const paiCarte    = await prisma.methodePaiement.findFirst({ where: { nom: 'Carte bancaire' } })
  const paiCheque   = await prisma.methodePaiement.findFirst({ where: { nom: 'Chèque' } })

  const fraisTransport     = await prisma.typeFrais.findFirst({ where: { nom: 'Transport' } })
  const fraisRestau        = await prisma.typeFrais.findFirst({ where: { nom: 'Restauration' } })
  const fraisHebergement   = await prisma.typeFrais.findFirst({ where: { nom: 'Hébergement' } })

  const perteVol    = await prisma.typePerte.findFirst({ where: { nom: 'Vol' } })
  const perteDeter  = await prisma.typePerte.findFirst({ where: { nom: 'Détérioration' } })

  // ─── Produits ─────────────────────────────────────────────────────────────────

  const produits = []

  const p1 = await prisma.produit.create({
    data: {
      nom: 'Les Âmes du Marais',
      description: 'Un roman sombre et poétique au cœur des terres sauvages.',
      categorieId: catRoman.id,
      prixVenteTTC: 18.00,
      tva: 5.5,
      cout: 4.50,
      droitAuteur: true,
      droitAuteurPourcent: 10,
      stock: 45,
      stockAlerte: 10,
      auteurs: { create: [{ auteurId: auteur1.id }] },
    },
  })
  produits.push(p1)

  const p2 = await prisma.produit.create({
    data: {
      nom: 'Horizons Perdus',
      description: 'Recueil de nouvelles sur la quête d\'identité.',
      categorieId: catNouvelle.id,
      prixVenteTTC: 12.00,
      tva: 5.5,
      cout: 3.00,
      droitAuteur: true,
      droitAuteurPourcent: 12,
      stock: 30,
      stockAlerte: 8,
      auteurs: { create: [{ auteurId: auteur2.id }] },
    },
  })
  produits.push(p2)

  const p3 = await prisma.produit.create({
    data: {
      nom: 'Murmures de l\'Aube',
      description: 'Recueil de poèmes.',
      categorieId: catPoesie.id,
      prixVenteTTC: 10.00,
      tva: 5.5,
      cout: 2.50,
      droitAuteur: true,
      droitAuteurPourcent: 15,
      stock: 20,
      stockAlerte: 5,
      auteurs: { create: [{ auteurId: auteur3.id }] },
    },
  })
  produits.push(p3)

  const p4 = await prisma.produit.create({
    data: {
      nom: 'La Mémoire des Pierres',
      description: 'Roman historique co-écrit.',
      categorieId: catRoman.id,
      prixVenteTTC: 20.00,
      tva: 5.5,
      cout: 5.00,
      droitAuteur: true,
      droitAuteurPourcent: 8,
      stock: 60,
      stockAlerte: 15,
      auteurs: {
        create: [
          { auteurId: auteur1.id },
          { auteurId: auteur2.id },
        ],
      },
    },
  })
  produits.push(p4)

  const p5 = await prisma.produit.create({
    data: {
      nom: 'Tote Bag "Écho des Plumes"',
      categorieId: catGoodie.id,
      prixVenteTTC: 8.00,
      tva: 20,
      cout: 2.00,
      droitAuteur: false,
      stock: 50,
      stockAlerte: 10,
    },
  })
  produits.push(p5)

  const p6 = await prisma.produit.create({
    data: {
      nom: 'Marque-pages illustrés (lot 5)',
      categorieId: catGoodie.id,
      prixVenteTTC: 3.00,
      tva: 20,
      cout: 0.60,
      droitAuteur: false,
      stock: 150,
      stockAlerte: 30,
    },
  })
  produits.push(p6)

  console.log(`${produits.length} produits créés`)

  // ─── Points de vente ──────────────────────────────────────────────────────────

  const pdv1 = await prisma.pointDeVente.create({
    data: {
      nom: 'Salon du Livre de Paris',
      ville: 'Paris',
      typePDVId: typeSalon.id,
      commissionFixe: 0,
      commissionPourcent: 20,
      typeEncaissement: 'pdv',
      actif: true,
    },
  })

  const pdv2 = await prisma.pointDeVente.create({
    data: {
      nom: 'Librairie du Centre',
      adresse: '12 rue de la Paix',
      ville: 'Lyon',
      typePDVId: typeLib.id,
      commissionFixe: 5,
      commissionPourcent: 15,
      typeEncaissement: 'nous',
      actif: true,
    },
  })

  const pdv3 = await prisma.pointDeVente.create({
    data: {
      nom: 'Festival des Mots',
      ville: 'Bordeaux',
      typePDVId: typeFestival.id,
      commissionFixe: 0,
      commissionPourcent: 10,
      typeEncaissement: 'nous',
      actif: true,
    },
  })

  console.log('Points de vente créés')

  // ─── Session 1 — clôturée (Salon de Paris) ───────────────────────────────────

  const session1 = await prisma.session.create({
    data: {
      pointDeVenteId: pdv1.id,
      statut: 'cloturee',
      debut: new Date('2026-01-15T09:00:00'),
      fin: new Date('2026-01-15T18:00:00'),
      remiseGlobale: 0,
    },
  })

  // Ventes session 1
  const v1a = await prisma.vente.create({
    data: {
      sessionId: session1.id,
      methodePaiementId: paiEspeces.id,
      type: 'session',
      lignes: {
        create: [
          { produitId: p1.id, quantite: 2, prixUnitaire: 18.00, remise: 0 },
          { produitId: p5.id, quantite: 1, prixUnitaire: 8.00, remise: 0 },
        ],
      },
    },
  })
  // Décrémenter stock
  await prisma.produit.update({ where: { id: p1.id }, data: { stock: { decrement: 2 } } })
  await prisma.produit.update({ where: { id: p5.id }, data: { stock: { decrement: 1 } } })

  const v1b = await prisma.vente.create({
    data: {
      sessionId: session1.id,
      methodePaiementId: paiCarte.id,
      type: 'session',
      lignes: {
        create: [
          { produitId: p4.id, quantite: 1, prixUnitaire: 20.00, remise: 0 },
          { produitId: p6.id, quantite: 3, prixUnitaire: 3.00, remise: 0 },
        ],
      },
    },
  })
  await prisma.produit.update({ where: { id: p4.id }, data: { stock: { decrement: 1 } } })
  await prisma.produit.update({ where: { id: p6.id }, data: { stock: { decrement: 3 } } })

  // Une vente annulée
  const v1c = await prisma.vente.create({
    data: {
      sessionId: session1.id,
      methodePaiementId: paiEspeces.id,
      type: 'session',
      annulee: true,
      lignes: {
        create: [{ produitId: p2.id, quantite: 1, prixUnitaire: 12.00, remise: 0 }],
      },
    },
  })

  // Frais session 1
  await prisma.frais.create({
    data: {
      sessionId: session1.id,
      typeFraisId: fraisTransport.id,
      libelle: 'Train Paris aller-retour',
      montant: 89.00,
    },
  })
  await prisma.frais.create({
    data: {
      sessionId: session1.id,
      typeFraisId: fraisRestau.id,
      libelle: 'Repas sur place',
      montant: 18.50,
    },
  })

  console.log('Session 1 (clôturée — Salon Paris) créée')

  // ─── Session 2 — clôturée (Librairie Lyon) ───────────────────────────────────

  const session2 = await prisma.session.create({
    data: {
      pointDeVenteId: pdv2.id,
      statut: 'cloturee',
      debut: new Date('2026-02-20T14:00:00'),
      fin: new Date('2026-02-20T19:00:00'),
      remiseGlobale: 5,
    },
  })

  const v2a = await prisma.vente.create({
    data: {
      sessionId: session2.id,
      methodePaiementId: paiCheque.id,
      type: 'session',
      lignes: {
        create: [
          { produitId: p2.id, quantite: 3, prixUnitaire: 12.00, remise: 0 },
          { produitId: p3.id, quantite: 2, prixUnitaire: 10.00, remise: 0 },
        ],
      },
    },
  })
  await prisma.produit.update({ where: { id: p2.id }, data: { stock: { decrement: 3 } } })
  await prisma.produit.update({ where: { id: p3.id }, data: { stock: { decrement: 2 } } })

  const v2b = await prisma.vente.create({
    data: {
      sessionId: session2.id,
      methodePaiementId: paiEspeces.id,
      type: 'session',
      lignes: {
        create: [
          { produitId: p1.id, quantite: 1, prixUnitaire: 18.00, remise: 10 },
        ],
      },
    },
  })
  await prisma.produit.update({ where: { id: p1.id }, data: { stock: { decrement: 1 } } })

  await prisma.frais.create({
    data: {
      sessionId: session2.id,
      typeFraisId: fraisTransport.id,
      libelle: 'Essence Lyon',
      montant: 42.00,
    },
  })

  console.log('Session 2 (clôturée — Librairie Lyon) créée')

  // ─── Session 3 — ouverte (Festival Bordeaux) ─────────────────────────────────

  const session3 = await prisma.session.create({
    data: {
      pointDeVenteId: pdv3.id,
      statut: 'ouverte',
      debut: new Date(),
      remiseGlobale: 0,
    },
  })

  const v3a = await prisma.vente.create({
    data: {
      sessionId: session3.id,
      methodePaiementId: paiCarte.id,
      type: 'session',
      lignes: {
        create: [
          { produitId: p4.id, quantite: 2, prixUnitaire: 20.00, remise: 0 },
          { produitId: p6.id, quantite: 5, prixUnitaire: 3.00, remise: 0 },
        ],
      },
    },
  })
  await prisma.produit.update({ where: { id: p4.id }, data: { stock: { decrement: 2 } } })
  await prisma.produit.update({ where: { id: p6.id }, data: { stock: { decrement: 5 } } })

  await prisma.frais.create({
    data: {
      sessionId: session3.id,
      typeFraisId: fraisHebergement.id,
      libelle: 'Hôtel Bordeaux 1 nuit',
      montant: 75.00,
    },
  })

  console.log('Session 3 (ouverte — Festival Bordeaux) créée')

  // ─── Dépôts ───────────────────────────────────────────────────────────────────

  await prisma.depot.create({
    data: {
      produitId: p1.id,
      pointDeVenteId: pdv2.id,
      quantite: 10,
      dateDepot: new Date('2026-03-01'),
      notes: 'Dépôt-vente 3 mois',
      actif: true,
    },
  })
  await prisma.produit.update({ where: { id: p1.id }, data: { stock: { decrement: 10 } } })

  await prisma.depot.create({
    data: {
      produitId: p3.id,
      pointDeVenteId: pdv2.id,
      quantite: 5,
      dateDepot: new Date('2026-03-01'),
      actif: true,
    },
  })
  await prisma.produit.update({ where: { id: p3.id }, data: { stock: { decrement: 5 } } })

  await prisma.depot.create({
    data: {
      produitId: p2.id,
      pointDeVenteId: pdv1.id,
      quantite: 8,
      dateDepot: new Date('2025-11-01'),
      dateRetour: new Date('2026-01-16'),
      actif: false,
      notes: 'Retourné après salon',
    },
  })

  console.log('Dépôts créés')

  // ─── Pertes ───────────────────────────────────────────────────────────────────

  await prisma.perte.create({
    data: {
      typePerteid: perteVol.id,
      produitId: p5.id,
      quantite: 2,
      valeur: 16.00,
      description: 'Vol constaté au salon de Paris',
    },
  })

  await prisma.perte.create({
    data: {
      typePerteid: perteDeter.id,
      produitId: p3.id,
      quantite: 1,
      valeur: 10.00,
      description: 'Livre mouillé lors du transport',
    },
  })

  console.log('Pertes créées')

  // ─── Frais hors session ───────────────────────────────────────────────────────

  await prisma.frais.create({
    data: {
      typeFraisId: fraisTransport.id,
      libelle: 'Abonnement parking annuel',
      montant: 120.00,
      sessionId: null,
    },
  })

  console.log('Frais hors session créés')

  console.log('\n✅ Fixtures chargées avec succès !')
  console.log('  Sessions clôturées : 2 (Paris + Lyon)')
  console.log('  Session ouverte : 1 (Bordeaux) — tu peux la trouver via l\'interface')
  console.log('  Dépôts actifs : 2 chez Librairie du Centre')
  console.log('  Pertes : 2')
  console.log('  Frais hors session : 1')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
