import prisma from '../../config/db.js'
import { unlink } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_BASE = resolve(__dirname, '../../uploads/instagram')

// ─── BACKGROUNDS ──────────────────────────────────────────────────────────────

export async function listBackgrounds() {
  return prisma.igBackground.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function createBackground({ nom, fichier, preview, estDefaut }) {
  if (estDefaut) {
    await prisma.igBackground.updateMany({ data: { estDefaut: false } })
  }
  return prisma.igBackground.create({ data: { nom, fichier, preview: preview ?? null, estDefaut: !!estDefaut } })
}

export async function setDefaultBackground(id) {
  await prisma.igBackground.updateMany({ data: { estDefaut: false } })
  return prisma.igBackground.update({ where: { id }, data: { estDefaut: true } })
}

export async function deleteBackground(id) {
  const bg = await prisma.igBackground.findUnique({ where: { id } })
  if (!bg) throw new Error('Background introuvable')
  await prisma.igBackground.delete({ where: { id } })
  await unlink(resolve(UPLOADS_BASE, 'backgrounds', bg.fichier)).catch(() => {})
  if (bg.preview) await unlink(resolve(UPLOADS_BASE, 'backgrounds', bg.preview)).catch(() => {})
}

// ─── ÉLÉMENTS ─────────────────────────────────────────────────────────────────

export async function listElements(tag) {
  const where = tag
    ? { tags: { contains: tag } }
    : {}
  return prisma.igElement.findMany({ where, orderBy: { createdAt: 'desc' } })
}

export async function createElement({ nom, fichier, preview, tags }) {
  return prisma.igElement.create({ data: { nom, fichier, preview: preview ?? null, tags: tags ?? '' } })
}

export async function updateElement(id, { nom, tags }) {
  return prisma.igElement.update({ where: { id }, data: { nom, tags } })
}

export async function deleteElement(id) {
  const el = await prisma.igElement.findUnique({ where: { id } })
  if (!el) throw new Error('Élément introuvable')
  await prisma.igElement.delete({ where: { id } })
  await unlink(resolve(UPLOADS_BASE, 'elements', el.fichier)).catch(() => {})
  if (el.preview) await unlink(resolve(UPLOADS_BASE, 'elements', el.preview)).catch(() => {})
}

// ─── FONTS ────────────────────────────────────────────────────────────────────

export async function listFonts() {
  return prisma.igFont.findMany({ orderBy: { nom: 'asc' } })
}

export async function createFont({ nom, fichier, googleFont, estDefautTitre, estDefautTexte }) {
  if (estDefautTitre) await prisma.igFont.updateMany({ data: { estDefautTitre: false } })
  if (estDefautTexte) await prisma.igFont.updateMany({ data: { estDefautTexte: false } })
  return prisma.igFont.create({
    data: { nom, fichier: fichier ?? null, googleFont: googleFont ?? null, estDefautTitre: !!estDefautTitre, estDefautTexte: !!estDefautTexte }
  })
}

export async function setDefaultFont(id, role) {
  if (role === 'titre') {
    await prisma.igFont.updateMany({ data: { estDefautTitre: false } })
    return prisma.igFont.update({ where: { id }, data: { estDefautTitre: true } })
  } else {
    await prisma.igFont.updateMany({ data: { estDefautTexte: false } })
    return prisma.igFont.update({ where: { id }, data: { estDefautTexte: true } })
  }
}

export async function deleteFont(id) {
  const font = await prisma.igFont.findUnique({ where: { id } })
  if (!font) throw new Error('Font introuvable')
  await prisma.igFont.delete({ where: { id } })
  if (font.fichier) await unlink(resolve(UPLOADS_BASE, 'fonts', font.fichier)).catch(() => {})
}

// ─── COULEURS ─────────────────────────────────────────────────────────────────

export async function listCouleurs() {
  return prisma.igCouleur.findMany({ orderBy: { nom: 'asc' } })
}

export async function createCouleur({ nom, valeur }) {
  return prisma.igCouleur.create({ data: { nom, valeur } })
}

export async function updateCouleur(id, { nom, valeur }) {
  return prisma.igCouleur.update({ where: { id }, data: { nom, valeur } })
}

export async function deleteCouleur(id) {
  return prisma.igCouleur.delete({ where: { id } })
}

// ─── POSTS ────────────────────────────────────────────────────────────────────

export async function listPosts() {
  return prisma.igPost.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getPost(id) {
  return prisma.igPost.findUnique({ where: { id } })
}

export async function listTemplates() {
  return prisma.igPost.findMany({ where: { estTemplate: true }, orderBy: { createdAt: 'desc' } })
}

export async function listBrouillonsPost() {
  return prisma.igPost.findMany({ where: { estTemplate: false }, orderBy: { createdAt: 'desc' } })
}

export async function createPost({ titre, vignettes, legende, sujet, legendeInstruction, estTemplate, format }) {
  return prisma.igPost.create({
    data: {
      titre: titre ?? null,
      format: format ?? 'portrait',
      vignettes,
      legende: legende ?? null,
      sujet: sujet ?? null,
      legendeInstruction: legendeInstruction ?? null,
      estTemplate: estTemplate ?? false,
    }
  })
}

export async function updatePost(id, { titre, vignettes, legende, statut, sujet, legendeInstruction, estTemplate, format }) {
  return prisma.igPost.update({
    where: { id },
    data: {
      ...(titre !== undefined && { titre }),
      ...(vignettes !== undefined && { vignettes }),
      ...(legende !== undefined && { legende }),
      ...(statut !== undefined && { statut }),
      ...(sujet !== undefined && { sujet }),
      ...(legendeInstruction !== undefined && { legendeInstruction }),
      ...(estTemplate !== undefined && { estTemplate }),
      ...(format !== undefined && { format }),
    }
  })
}

export async function deletePost(id) {
  return prisma.igPost.delete({ where: { id } })
}

// ─── PLANIFICATION ────────────────────────────────────────────────────────────

export async function listPlanifications() {
  return prisma.igPlanification.findMany({
    orderBy: { datePost: 'asc' },
    include: { template: { select: { id: true, titre: true, format: true, vignettes: true } } },
  })
}

export async function createPlanification({ templateId, sujet, datePost }) {
  return prisma.igPlanification.create({
    data: { templateId: Number(templateId), sujet, datePost: new Date(datePost) },
    include: { template: { select: { id: true, titre: true, format: true } } },
  })
}

export async function updatePlanification(id, data) {
  return prisma.igPlanification.update({ where: { id }, data })
}

export async function deletePlanification(id) {
  return prisma.igPlanification.delete({ where: { id } })
}

// ─── EXCLUSIONS ───────────────────────────────────────────────────────────────

export async function listExclusions() {
  return prisma.igExclusion.findMany({ orderBy: { nom: 'asc' } })
}

export async function createExclusion({ igUserId, nom, note }) {
  return prisma.igExclusion.create({ data: { igUserId, nom, note: note ?? null } })
}

export async function deleteExclusion(id) {
  return prisma.igExclusion.delete({ where: { id } })
}

// ─── BROUILLONS ───────────────────────────────────────────────────────────────

export async function listBrouillons(statut) {
  const where = statut ? { statut } : {}
  return prisma.igBrouillon.findMany({ where, orderBy: { createdAt: 'desc' } })
}

export async function updateBrouillon(id, { textePropose, statut }) {
  return prisma.igBrouillon.update({
    where: { id },
    data: {
      ...(textePropose !== undefined && { textePropose }),
      ...(statut !== undefined && { statut }),
    }
  })
}
