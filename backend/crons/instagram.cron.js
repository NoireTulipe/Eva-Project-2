/**
 * instagram.cron.js — Publication programmée des posts Instagram
 *
 * Toutes les minutes : vérifie s'il y a des posts dont scheduledAt <= maintenant
 * et qui sont au statut "programme". Lance la publication via Meta API.
 *
 * Les images exportées (base64) sont stockées dans IgPost.vignettes sous la clé
 * "_export" ajoutée par le frontend au moment de la programmation.
 */

import prisma from '../config/db.js'
import { publierPost } from '../modules/instagram/instagram.meta.js'
import { logAction, logError } from '../logs/logger.js'

export async function publierPostsProgrammes() {
  const maintenant = new Date()

  const posts = await prisma.igPost.findMany({
    where: {
      statut: 'programme',
      scheduledAt: { lte: maintenant },
    }
  })

  if (posts.length === 0) return

  logAction(`Instagram cron: ${posts.length} post(s) à publier`)

  for (const post of posts) {
    try {
      const vignettes = JSON.parse(post.vignettes)
      const exports = vignettes.map(v => v._export).filter(Boolean)

      if (exports.length === 0) {
        await prisma.igPost.update({
          where: { id: post.id },
          data: { statut: 'erreur', erreurPubli: 'Images exportées introuvables dans le post' }
        })
        continue
      }

      await publierPost(post.id, exports)
    } catch (e) {
      logError(`Instagram cron: post ${post.id} — ${e.message}`)
    }
  }
}
