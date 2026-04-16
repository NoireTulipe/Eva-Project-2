import puppeteer from 'puppeteer'
import { logAction, logError } from '../../logs/logger.js'
import prisma from '../../config/db.js'

// ─── Config WooCommerce / WordPress ──────────────────────────────────────────

const WP_BASE = process.env.WC_URL || 'https://echodeplumes.com'

function getWcAuth() {
  return 'Basic ' + Buffer.from(
    `${process.env.WC_CLIENT_KEY}:${process.env.WC_CLIENT_SECRET}`
  ).toString('base64')
}

function getWpAuth() {
  const pass = (process.env.WP_APPLICATION_PASSWORD || '').replace(/\s/g, '')
  return 'Basic ' + Buffer.from(
    `${process.env.WP_USERNAME}:${pass}`
  ).toString('base64')
}

// ─── Slugification ────────────────────────────────────────────────────────────

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── WooCommerce REST ─────────────────────────────────────────────────────────

async function wcRequest(method, endpoint, body = null) {
  const url = `${WP_BASE}/wp-json/wc/v3${endpoint}`
  const options = {
    method,
    headers: { 'Authorization': getWcAuth(), 'Content-Type': 'application/json' }
  }
  if (body) options.body = JSON.stringify(body)
  const res = await fetch(url, options)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`WC API ${method} ${endpoint} → ${res.status} : ${json.message || JSON.stringify(json)}`)
  }
  return json
}

// ─── Upload image vers la médiathèque WordPress ───────────────────────────────
// Retourne { id, src } — on passe l'ID à WooCommerce pour éviter le double upload

export async function uploadWPImage(source, filename, metadata = {}) {
  logAction(`Upload image WP : ${filename}`)

  let imageBuffer
  let mimeType = 'image/jpeg'

  if (Buffer.isBuffer(source)) {
    // Buffer direct (upload utilisateur)
    imageBuffer = source
    if (filename.endsWith('.png')) mimeType = 'image/png'
    else if (filename.endsWith('.webp')) mimeType = 'image/webp'
  } else if (source.startsWith('http')) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`Impossible de télécharger l'image : ${source}`)
    imageBuffer = Buffer.from(await res.arrayBuffer())
    const ct = res.headers.get('content-type')
    if (ct) mimeType = ct.split(';')[0]
  } else {
    const { readFileSync } = await import('fs')
    imageBuffer = readFileSync(source)
    if (filename.endsWith('.png')) mimeType = 'image/png'
  }

  // 1. Upload binaire
  const uploadRes = await fetch(`${WP_BASE}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization': getWpAuth(),
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`
    },
    body: imageBuffer
  })
  const uploadJson = await uploadRes.json()
  if (!uploadRes.ok) {
    throw new Error(`Upload média échoué : ${uploadJson.message || JSON.stringify(uploadJson)}`)
  }

  const mediaId  = uploadJson.id
  const mediaSrc = uploadJson.source_url

  // 2. Patch métadonnées SEO si fournies
  if (metadata.altText || metadata.title || metadata.caption || metadata.description) {
    await fetch(`${WP_BASE}/wp-json/wp/v2/media/${mediaId}`, {
      method: 'POST',  // WP REST utilise POST pour mettre à jour un média existant
      headers: { 'Authorization': getWpAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alt_text:    metadata.altText    || '',
        title:       metadata.title      || '',
        caption:     metadata.caption    || '',
        description: metadata.description || ''
      })
    })
  }

  logAction(`Image WP uploadée : ${mediaSrc} (ID: ${mediaId})`)
  return { id: mediaId, src: mediaSrc }
}

// ─── Scraper Amazon (Puppeteer) ───────────────────────────────────────────────

let lastScrapeTime = null
const MIN_DELAY_MS = 30000

export async function scrapeAmazon(url) {
  if (lastScrapeTime) {
    const elapsed = Date.now() - lastScrapeTime
    const remaining = MIN_DELAY_MS - elapsed
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
  }

  let browser
  try {
    logAction(`Scraping Amazon : ${url}`)
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    })

    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    )
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    })

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('#productTitle', { timeout: 10000 })

    const data = await page.evaluate(() => {
      const cleanText = (text) => text?.trim().replace(/\s+/g, ' ') || ''

      const title = cleanText(document.getElementById('productTitle')?.textContent)

      const authors = []
      document.querySelectorAll('.author.notFaded').forEach(authorEl => {
        const link = authorEl.querySelector('a.a-link-normal')
        const roleSpan = authorEl.querySelector('.contribution .a-color-secondary')
        if (link) authors.push({
          name: cleanText(link.textContent),
          role: cleanText(roleSpan?.textContent.replace(/[()]/g, ''))
        })
      })

      let priceAmount = null
      const priceDataDiv = document.querySelector('.twister-plus-buying-options-price-data')
      if (priceDataDiv) {
        try {
          const priceJson = JSON.parse(priceDataDiv.textContent)
          const firstPrice = priceJson.desktop_buybox_group_1?.[0]
          if (firstPrice) priceAmount = firstPrice.priceAmount
        } catch {}
      }

      let coverImage = null, backCoverImage = null
      for (const script of document.querySelectorAll('script[type="text/javascript"]')) {
        const content = script.textContent
        if (!content.includes("'colorImages'") || !content.includes("'initial'")) continue
        const startIdx = content.indexOf("'initial': [")
        if (startIdx === -1) continue
        let depth = 0, arrayStart = content.indexOf('[', startIdx), arrayEnd = -1
        for (let i = arrayStart; i < content.length; i++) {
          if (content[i] === '[') depth++
          else if (content[i] === ']') { depth--; if (depth === 0) { arrayEnd = i; break } }
        }
        if (arrayStart === -1 || arrayEnd === -1) continue
        try {
          const images = JSON.parse(content.substring(arrayStart, arrayEnd + 1))
          const main = images.find(img => img.variant === 'MAIN')
          const back = images.find(img => img.variant === 'BACK')
          if (main) coverImage = main.hiRes || main.large || null
          if (back) backCoverImage = back.hiRes || back.large || null
        } catch {}
        break
      }
      if (!coverImage) {
        const fallback = document.querySelector('#landingImage') || document.querySelector('#imgBlkFront')
        coverImage = fallback?.src || null
      }

      const descElement = document.querySelector('#bookDescription_feature_div .a-expander-content')
        || document.querySelector('#productDescription')
      let description = ''
      if (descElement) {
        description = descElement.innerHTML
          .replace(/<span class="a-text-bold">/g, '<strong>')
          .replace(/<\/span>/g, '</strong>')
          .replace(/<span>/g, '')
          .trim()
      }

      const seriesLink = document.querySelector('#seriesBulletWidget_feature_div a')
      const series = seriesLink ? cleanText(seriesLink.textContent) : null

      const details = {}
      document.querySelectorAll('#detailBullets_feature_div .detail-bullet-list li').forEach(li => {
        const listItem = li.querySelector('.a-list-item')
        const labelEl = listItem?.querySelector('.a-text-bold')
        if (labelEl) {
          const label = labelEl.textContent.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[:\s‎‏]+$/g, '').trim()
          const tempNode = listItem.cloneNode(true)
          tempNode.querySelector('.a-text-bold')?.remove()
          const value = tempNode.textContent.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[:\s‎‏]+/g, ' ').trim()
          if (label && value) details[label] = value
        }
      })

      return { title, authors, priceAmount, coverImage, backCoverImage, description, series, details }
    })

    await browser.close()
    lastScrapeTime = Date.now()

    const extractNumber = (text) => {
      if (!text) return null
      const match = text.match(/\d+/)
      return match ? parseInt(match[0], 10) : null
    }

    const normalized = {
      source: 'amazon',
      title: data.title,
      authors: data.authors,
      priceAmount: data.priceAmount,
      currency: '€',
      coverImage: data.coverImage,
      backCoverImage: data.backCoverImage || null,
      description: data.description,
      series: data.series,
      details: {
        asin: data.details['ASIN'] || null,
        isbn13: data.details['ISBN-13'] || null,
        isbn10: data.details['ISBN-10'] || null,
        publisher: data.details['Éditeur'] || data.details['Editeur'] || null,
        publicationDate: data.details['Date de publication'] || null,
        language: data.details['Langue'] || null,
        pages: extractNumber(data.details["Nombre de pages de l'édition imprimée"]) || null,
        weight: data.details["Poids de l'article"] || null,
        dimensions: data.details['Dimensions'] || null
      }
    }

    logAction(`Scraping Amazon réussi : ${normalized.title}`)
    return normalized

  } catch (error) {
    if (browser) await browser.close()
    logError(`Erreur scraping Amazon : ${error.message}`)
    throw error
  }
}

// ─── Génération description courte via Gemini ─────────────────────────────────

export async function generateShortDescription(description) {
  if (!description) throw new Error('Description vide.')
  if (!process.env.GEMINI_API_KEY) throw new Error('Clé Gemini manquante.')

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(
    `Tu es un libraire passionné. À partir de cette description de livre, rédige une accroche commerciale courte de 3 à 4 phrases maximum, en français, sans spoiler, qui donne envie d'acheter. Pas de titre, pas de "Découvrez", juste l'accroche.\n\nDescription : ${description}`
  )
  return result.response.text().trim()
}

// ─── Catégories WooCommerce ───────────────────────────────────────────────────

let _categoriesCache = null

export async function getWcCategories() {
  if (!_categoriesCache) {
    _categoriesCache = await wcRequest('GET', '/products/categories?per_page=100&orderby=name&order=asc')
  }
  return _categoriesCache
}

// ─── Créer un produit WooCommerce ─────────────────────────────────────────────

export async function createWooProduct(bookData, options = {}) {
  logAction(`Création produit WooCommerce : ${bookData.title}`)

  const price       = options.price ?? (bookData.priceAmount ? String(bookData.priceAmount) : '0.00')
  const autoPublish = options.autoPublish ?? false

  const titleSlug  = slugify(bookData.title)
  const authorSlug = slugify((bookData.authors?.[0]?.name) || '')
  const authorLabel = (bookData.authors || []).map(a => a.name).filter(Boolean).join(', ') || ''

  // 1. Upload couverture → ID WP (évite le double upload par WooCommerce)
  const images = []

  if (bookData.coverImage) {
    try {
      const filename = `${titleSlug}-${authorSlug}-recto.jpg`
      const media = await uploadWPImage(bookData.coverImage, filename, {
        altText:     `Couverture recto de ${bookData.title}. Un livre écrit par ${authorLabel}`,
        title:       `${bookData.title} - recto`,
        caption:     `Couverture de « ${bookData.title} » par ${authorLabel}`,
        description: `Couverture recto de ${bookData.title}. Un livre écrit par ${authorLabel}`
      })
      images.push({ id: media.id, position: 0 })
    } catch (e) {
      logError(`Impossible d'uploader la couverture : ${e.message}`)
    }
  }

  if (bookData.backCoverImage) {
    try {
      const filename = `${titleSlug}-${authorSlug}-verso.jpg`
      const media = await uploadWPImage(bookData.backCoverImage, filename, {
        altText:     `Couverture verso de ${bookData.title}. Un livre écrit par ${authorLabel}`,
        title:       `${bookData.title} - verso`,
        caption:     `Quatrième de couverture de « ${bookData.title} » par ${authorLabel}`,
        description: `Couverture verso de ${bookData.title}. Un livre écrit par ${authorLabel}`
      })
      images.push({ id: media.id, position: 1 })
    } catch (e) {
      logError(`Impossible d'uploader le verso : ${e.message}`)
    }
  }

  // Images supplémentaires déjà uploadées (IDs WP passés depuis l'UI)
  const extraIds = options.extraImageIds || []
  extraIds.forEach((id, i) => {
    images.push({ id, position: images.length + i })
  })

  // 2. Catégories
  const categoryIds = (options.categoryIds || []).map(id => ({ id }))

  // 3. Attributs
  const attrs = []

  const authorNames = bookData.authors?.map(a => a.name).filter(Boolean) || []
  if (authorNames.length) {
    attrs.push({
      name: 'Auteurs', slug: 'pa_auteurs',
      visible: true, variation: false,
      options: authorNames
    })
  }

  if (bookData.details?.pages) {
    attrs.push({
      name: 'Nombre de pages', slug: 'pa_nombre-de-pages',
      visible: true, variation: false,
      options: [`${bookData.details.pages} pages`]
    })
  }

  if (options.impression) {
    attrs.push({
      name: 'Impression des pages intérieures', slug: 'pa_impression-des-pages',
      visible: true, variation: false,
      options: [options.impression]
    })
  }

  const isbn = bookData.details?.isbn13 || bookData.details?.isbn10 || null
  if (isbn) {
    attrs.push({
      name: 'ISBN', slug: 'pa_isbn',
      visible: true, variation: false,
      options: [isbn]
    })
  }

  // 4. Dimensions
  let dimensions
  if (bookData.details?.dimensions) {
    const parts = bookData.details.dimensions
      .replace(/cm.*/i, '').trim()
      .split(/\s*x\s*/i)
      .map(v => v.trim().replace(',', '.'))
    if (parts.length === 3) dimensions = { length: parts[0], width: parts[1], height: parts[2] }
  }

  const payload = {
    name: bookData.title,
    type: 'simple',
    status: autoPublish ? 'publish' : 'draft',
    description: bookData.description || '',
    short_description: options.shortDescription || '',
    regular_price: price,
    manage_stock: false,
    stock_status: 'instock',
    categories: categoryIds,
    images,
    attributes: attrs,
    upsell_ids: options.upsellIds || [],
    ...(bookData.details?.weight && {
      weight: bookData.details.weight.replace(/[^\d,.]/, '').replace(',', '.').split(' ')[0]
    }),
    ...(dimensions && { dimensions })
  }

  const product = await wcRequest('POST', '/products', payload)
  logAction(`Produit WooCommerce créé : ${product.name} (ID: ${product.id})`)

  return {
    id: product.id,
    name: product.name,
    permalink: product.permalink,
    status: product.status,
    editUrl: `${WP_BASE}/wp-admin/post.php?post=${product.id}&action=edit`
  }
}

// ─── Prompt général articles (ConfigParam) ───────────────────────────────────

const NEWS_PROMPT_KEY = 'site.news_prompt'

const DEFAULT_NEWS_PROMPT = `Tu es le rédacteur officiel des Éditions Écho de Plumes, une maison d'édition indépendante spécialisée dans les romans illustrés, les "romanga" et les œuvres jeunesse/YA. Les auteurs de la maison sont Magali et François Bonacci.

Tu rédiges des articles de blog enthousiastes et chaleureux pour le site WordPress d'Écho de Plumes. Tutoiement avec les lecteurs autorisé. Utilise quelques emojis avec parcimonie.

STRUCTURE OBLIGATOIRE :
1. Introduction accrocheuse (1-2 paragraphes <p>)
2. <hr class="wp-block-separator has-alpha-channel-opacity"/>
3. Sections avec <h2 class="wp-block-heading"><strong>...</strong></h2> et <h3 class="wp-block-heading"><strong>...</strong></h3>
4. Listes <ul class="wp-block-list"> ou <ol start="1" class="wp-block-list"> avec <li>
5. Éventuellement une <blockquote class="wp-block-quote is-layout-flow wp-block-quote-is-layout-flow"><p>...</p></blockquote>
6. <hr class="wp-block-separator has-alpha-channel-opacity"/> entre grandes sections
7. Call-to-action final (1 paragraphe)

FORMAT DE SORTIE : JSON strict, sans markdown autour, avec exactement deux champs :
- "title" : titre accrocheur commençant obligatoirement par un emoji unicode (🎉 📚 ✨ 🔥 🎊 📖 🌟 etc.)
- "content" : corps complet en HTML WordPress Gutenberg

Ne génère QUE le JSON brut.`

export async function getNewsPrompt() {
  const row = await prisma.configParam.findUnique({ where: { cle: NEWS_PROMPT_KEY } })
  return row ? row.valeur : DEFAULT_NEWS_PROMPT
}

export async function saveNewsPrompt(valeur) {
  await prisma.configParam.upsert({
    where:  { cle: NEWS_PROMPT_KEY },
    update: { valeur },
    create: { cle: NEWS_PROMPT_KEY, valeur, description: 'Prompt général pour la génération d\'articles de news' }
  })
}

// ─── Générer un article via Gemini 2.5 Pro ────────────────────────────────────

export async function generateArticle(generalPrompt, instruction) {
  if (!instruction?.trim()) throw new Error('Instruction vide.')
  if (!process.env.GEMINI_API_KEY) throw new Error('Clé Gemini manquante.')

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })

  const prompt = `${generalPrompt}\n\n---\n\nINSTRUCTIONS POUR CET ARTICLE :\n${instruction}`

  const result = await model.generateContent(prompt)
  const raw    = result.response.text().trim()

  // Nettoyer si Gemini a quand même mis du markdown autour
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('La réponse de Gemini n\'est pas un JSON valide. Réessaie.')
  }

  if (!parsed.title || !parsed.content) {
    throw new Error('JSON incomplet : champs "title" et "content" attendus.')
  }

  logAction(`Article généré : ${parsed.title}`)
  return { title: parsed.title, content: parsed.content }
}

// ─── Publier un article WordPress ────────────────────────────────────────────

export async function publishWPArticle({ title, content, date, status = 'draft', featuredMediaId = null }) {
  logAction(`Publication article WP : ${title} (${status})`)

  const body = { title, content, status }
  if (date) {
    // WordPress exige le format complet YYYY-MM-DDTHH:MM:SS
    const normalized = date.length === 16 ? `${date}:00` : date
    body.date = normalized
  }
  if (featuredMediaId) body.featured_media = featuredMediaId

  const url = `${WP_BASE}/wp-json/wp/v2/posts`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': getWpAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(`WP Posts API → ${res.status} : ${json.message || JSON.stringify(json)}`)
  }

  logAction(`Article WP créé : ${json.title?.rendered} (ID: ${json.id})`)
  return {
    id:      json.id,
    title:   json.title?.rendered || title,
    status:  json.status,
    link:    json.link,
    editUrl: `${WP_BASE}/wp-admin/post.php?post=${json.id}&action=edit`
  }
}

// ─── Lister les produits WooCommerce ─────────────────────────────────────────

export async function listWooProducts(filters = {}) {
  const limit  = filters.limit  || 20
  const status = filters.status || 'any'
  const products = await wcRequest('GET', `/products?per_page=${limit}&status=${status}&orderby=date&order=desc`)
  return products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    status: p.status,
    permalink: p.permalink,
    editUrl: `${WP_BASE}/wp-admin/post.php?post=${p.id}&action=edit`,
    image: p.images?.[0]?.src || null
  }))
}

// Liste légère pour le combobox (id + nom + poids)
export async function listWooProductsLite() {
  const products = await wcRequest('GET', '/products?per_page=100&status=any&orderby=title&order=asc')
  return products.map(p => ({
    id: p.id,
    name: p.name,
    weight: p.weight || ''
  }))
}

// ─── Livraison — Zones & méthodes ────────────────────────────────────────────

export async function getShippingZonesWithMethods() {
  const zones = await wcRequest('GET', '/shipping/zones')
  return Promise.all(
    zones.map(async zone => {
      const methods = await wcRequest('GET', `/shipping/zones/${zone.id}/methods`)
      return { id: zone.id, name: zone.name, order: zone.order, methods }
    })
  )
}

export async function addShippingMethod(zoneId, methodId) {
  return wcRequest('POST', `/shipping/zones/${zoneId}/methods`, { method_id: methodId })
}

export async function updateShippingMethod(zoneId, instanceId, data) {
  return wcRequest('PUT', `/shipping/zones/${zoneId}/methods/${instanceId}`, data)
}

export async function deleteShippingMethod(zoneId, instanceId) {
  return wcRequest('DELETE', `/shipping/zones/${zoneId}/methods/${instanceId}?force=true`)
}

// ─── Livraison — Classes d'expédition (tranches de poids) ────────────────────

export async function getShippingClasses() {
  return wcRequest('GET', '/products/shipping_classes?per_page=100')
}

// ─── Seed livraison — Tarifs La Poste via Echo Shipping ──────────────────────

const RATES_SIMPLE = [
  { min: 0,    max: 0.1,  price: 2.32 },
  { min: 0.1,  max: 0.25, price: 4.00 },
  { min: 0.25, max: 0.5,  price: 6.00 },
  { min: 0.5,  max: 1.0,  price: 7.25 },
  { min: 1.0,  max: 999,  price: 8.85 },
]

const RATES_SUIVI = [
  { min: 0,    max: 0.1,  price: 2.82 },
  { min: 0.1,  max: 0.25, price: 4.50 },
  { min: 0.25, max: 0.5,  price: 6.50 },
  { min: 0.5,  max: 1.0,  price: 7.75 },
  { min: 1.0,  max: 999,  price: 9.35 },
]

export async function seedShipping() {
  const existingZones = await wcRequest('GET', '/shipping/zones')
  if (existingZones.find(z => z.name === 'France métropolitaine')) {
    throw new Error('La zone "France métropolitaine" existe déjà — seed annulé.')
  }

  // 1. Zone France
  const zone = await wcRequest('POST', '/shipping/zones', { name: 'France métropolitaine', order: 0 })
  await wcRequest('PUT', `/shipping/zones/${zone.id}/locations`, [{ code: 'FR', type: 'country' }])

  // Helper : crée une instance echo_shipping + configure titre et grille
  // On fait un GET après le POST pour s'assurer que les settings sont enregistrés
  async function addEchoMethod(title, rates) {
    const method = await wcRequest('POST', `/shipping/zones/${zone.id}/methods`, { method_id: 'echo_shipping' })
    const fresh  = await wcRequest('GET', `/shipping/zones/${zone.id}/methods/${method.instance_id}`)
    const settings = {}
    if ('title' in (fresh.settings || {})) settings.title = { value: title }
    if ('rates' in (fresh.settings || {})) settings.rates = { value: JSON.stringify(rates) }
    await wcRequest('PUT', `/shipping/zones/${zone.id}/methods/${method.instance_id}`, { title, settings })
  }

  // 2. La Poste simple
  await addEchoMethod('La Poste simple', RATES_SIMPLE)

  // 3. La Poste avec suivi
  await addEchoMethod('La Poste avec suivi', RATES_SUIVI)

  // 4. Retrait sur place (local_pickup natif WC — gratuit)
  const pickup = await wcRequest('POST', `/shipping/zones/${zone.id}/methods`, { method_id: 'local_pickup' })
  await wcRequest('PUT', `/shipping/zones/${zone.id}/methods/${pickup.instance_id}`, {
    title:    'Retrait sur place',
    settings: { cost: { value: '0' } }
  })

  logAction(`Seed livraison : zone ${zone.id}, 3 méthodes (echo_shipping x2 + local_pickup)`)
  return { ok: true, zoneId: zone.id }
}

// ─── Livraison — Affecter une classe aux produits ────────────────────────────

export async function setProductsShippingClass(productIds, classSlug) {
  let ids = productIds
  if (productIds === 'all') {
    const products = await wcRequest('GET', '/products?per_page=100&status=any')
    ids = products.map(p => p.id)
  }
  if (!ids.length) return { ok: true, updated: 0 }

  // Batch update par tranches de 100 (limite WC)
  const CHUNK = 100
  let updated = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    await wcRequest('POST', '/products/batch', {
      update: chunk.map(id => ({ id, shipping_class: classSlug }))
    })
    updated += chunk.length
  }
  logAction(`Classe d'expédition "${classSlug}" appliquée à ${updated} produit(s)`)
  return { ok: true, updated }
}
