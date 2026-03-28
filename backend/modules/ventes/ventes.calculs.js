/**
 * Calculs financiers du module ventes.
 * Zéro LLM ici — tout est fait par le code.
 */

/**
 * Calcule le montant HT d'une ligne de vente
 */
export function calcHT(prixTTC, tva) {
  if (tva === 0) return prixTTC
  return prixTTC / (1 + tva / 100)
}

/**
 * Calcule le montant de la remise sur une ligne
 */
export function calcRemise(prixUnitaire, remisePourcent) {
  return prixUnitaire * (remisePourcent / 100)
}

/**
 * Calcule le prix net d'une ligne après remise
 */
export function calcPrixNet(prixUnitaire, remisePourcent) {
  return prixUnitaire - calcRemise(prixUnitaire, remisePourcent)
}

/**
 * Calcule le total d'une ligne de vente
 */
export function calcTotalLigne(prixUnitaire, quantite, remisePourcent) {
  return calcPrixNet(prixUnitaire, remisePourcent) * quantite
}

/**
 * Calcule le CA total d'une vente (toutes lignes)
 */
export function calcCAVente(lignes) {
  return lignes.reduce((acc, l) => {
    return acc + calcTotalLigne(l.prixUnitaire, l.quantite, l.remise)
  }, 0)
}

/**
 * Calcule le CA total d'une session avec remise globale
 */
export function calcCASession(ventes, remiseGlobalePourcent = 0) {
  const caAvantRemise = ventes.reduce((acc, v) => {
    if (v.annulee) return acc
    return acc + calcCAVente(v.lignes)
  }, 0)
  return calcPrixNet(caAvantRemise, remiseGlobalePourcent)
}

/**
 * Calcule la commission du point de vente
 */
export function calcCommissionPDV(ca, commissionFixe, commissionPourcent) {
  return commissionFixe + ca * (commissionPourcent / 100)
}

/**
 * Calcule les droits auteur pour un produit
 */
export function calcDroitsAuteur(totalLigne, droitAuteur, droitAuteurPourcent) {
  if (!droitAuteur) return 0
  return totalLigne * (droitAuteurPourcent / 100)
}

/**
 * Calcule le bénéfice net d'une session
 * CA - commission PDV - droits auteur - frais
 */
export function calcBeneficeNet(ca, commissionPDV, droitsAuteur, totalFrais) {
  return ca - commissionPDV - droitsAuteur - totalFrais
}

/**
 * Calcule le récapitulatif complet d'une session
 */
export function calcRecapSession(session) {
  const { ventes, frais, pointDeVente } = session

  const ca = calcCASession(ventes, session.remiseGlobale)

  const commissionPDV = calcCommissionPDV(
    ca,
    pointDeVente.commissionFixe,
    pointDeVente.commissionPourcent
  )

  const droitsAuteur = ventes.reduce((acc, v) => {
    if (v.annulee) return acc
    return acc + v.lignes.reduce((a, l) => {
      const total = calcTotalLigne(l.prixUnitaire, l.quantite, l.remise)
      return a + calcDroitsAuteur(total, l.produit.droitAuteur, l.produit.droitAuteurPourcent)
    }, 0)
  }, 0)

  const totalFrais = frais.reduce((acc, f) => acc + f.montant, 0)

  const beneficeNet = calcBeneficeNet(ca, commissionPDV, droitsAuteur, totalFrais)

  return {
    ca: round(ca),
    commissionPDV: round(commissionPDV),
    droitsAuteur: round(droitsAuteur),
    totalFrais: round(totalFrais),
    beneficeNet: round(beneficeNet),
  }
}

/**
 * Arrondi à 2 décimales
 */
export function round(val) {
  return Math.round(val * 100) / 100
}