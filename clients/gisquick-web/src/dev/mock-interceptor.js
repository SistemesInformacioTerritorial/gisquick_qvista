// Interceptor per simular respostes del servidor amb dades mock
import { mockProjectData, mockSearchResults } from './mock-project-data.js'

export function setupMockInterceptor() {
  // Interceptar fetch per simular les crides al servidor
  const originalFetch = window.fetch
  
  window.fetch = async function(url, options) {
    console.log('Mock interceptor - URL:', url)
    
    // Simular càrrega del projecte
    if (url.includes('/api/project/') && url.includes('.json')) {
      console.log('Mock: Retornant dades del projecte amb qV_search')
      return new Response(JSON.stringify(mockProjectData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Simular cerca específica en capes
    if (url.includes('/api/map/') && url.includes('search')) {
      const urlObj = new URL(url, window.location.origin)
      const layer = urlObj.searchParams.get('layer')
      const query = urlObj.searchParams.get('query') || urlObj.searchParams.get('q')
      
      console.log('Mock: Cerca específica - layer:', layer, 'query:', query)
      
      if (layer && query && mockSearchResults[layer]) {
        // Filtrar resultats segons la query
        const results = mockSearchResults[layer].filter(item => {
          const searchField = layer === 'parceles' ? 'CODI' : 'NOM_MUNI'
          return item[searchField].toLowerCase().includes(query.toLowerCase())
        })
        
        console.log('Mock: Resultats trobats:', results.length)
        
        return new Response(JSON.stringify({
          features: results.map(item => ({
            properties: item,
            geometry: item.geometry
          }))
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    // Per altres crides, usar el fetch original
    return originalFetch.apply(this, arguments)
  }
  
  console.log('Mock interceptor configurat per proves de cerca específica')
}

// Funcció per desactivar el mock
export function disableMockInterceptor() {
  // Restaurar fetch original si existeix
  if (window.originalFetch) {
    window.fetch = window.originalFetch
    delete window.originalFetch
    console.log('Mock interceptor desactivat')
  }
}
