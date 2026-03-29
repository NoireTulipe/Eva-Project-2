export const webTools = [
  {
    name: 'search_web',
    category: 'web',
    description: 'Effectue une recherche sur le web via Brave Search et retourne les résultats',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'La requête de recherche' },
        count: { type: 'number', description: 'Nombre de résultats souhaités (1-10, défaut 5)' }
      },
      required: ['query']
    },
    async execute({ query, count = 5 }) {
      const url = new URL('https://api.search.brave.com/res/v1/web/search')
      url.searchParams.set('q', query)
      url.searchParams.set('count', Math.min(Math.max(1, count), 10))
      url.searchParams.set('language', 'fr')

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': process.env.BRAVE_API_KEY
        }
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error('Clé API Brave invalide')
        if (response.status === 429) throw new Error('Rate limit Brave atteint')
        throw new Error(`Brave Search : HTTP ${response.status}`)
      }

      const data = await response.json()
      const results = (data.web?.results || []).map(r => ({
        titre: r.title,
        url: r.url,
        description: r.description || ''
      }))

      return { query, resultats: results }
    }
  }
]
