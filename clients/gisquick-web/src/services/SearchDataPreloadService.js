import GeoJSON from 'ol/format/GeoJSON'

/**
 * Servicio para precargar datos de búsqueda
 */
export class SearchDataPreloadService {
  constructor(http, store) {
    this.http = http;
    this.store = store;

    // Eliminar referencias al mapa
    // this.map = map;
  }
  
  /**
   * Registra el módulo de store para almacenar datos de búsqueda
   */
  registerStoreModule() {
    // Comentamos el registro del módulo en el store
    // this.store.registerModule('searchData', {
    //   namespaced: true,
    //   state: { 
    //     layerData: {} // Estructura: { layerName: [features] }
    //   },
    //   mutations: {
    //     setLayerData(state, { layerName, features }) {
    //       state.layerData = { 
    //         ...state.layerData, 
    //         [layerName]: features 
    //       }
    //       console.log(`✅ Dades guardades al searchData: ${features.length} features per ${layerName}`)
    //     }
    //   }
    // })
  }
  
  /**
   * Método principal para precargar datos de capas
   */
  async preloadSearchLayersData(projectLayers) {
    if (!projectLayers || !Array.isArray(projectLayers)) return
    
    const layersWithSearch = projectLayers.filter(l => l.qV_search)
    console.log('🔄 Preloading data for layers with search:', layersWithSearch.length)
    
    // Cargar datos para cada capa con búsqueda
    for (const layer of layersWithSearch) {
      console.log('🔄 Preloading', layer.name, '...')
      try {
        const features = await this.loadLayerFeaturesForSearch(layer.name)
        if (features && features.length) {
          this.store.commit('searchData/setLayerData', { 
            layerName: layer.name, 
            features 
          })
        }
      } catch (error) {
        console.error('❌ Error precarregant', layer.name, ':', error)
      }
    }
  }
  
  /**
   * Carga datos de una capa específica vía WFS
   */
  async loadLayerFeaturesForSearch(layerName) {
    try {
      // Obtener el nombre del proyecto
      let projectName = 'int/cultureta' // Default
      
      if (this.store.state.project?.config?.project) {
        projectName = this.store.state.project.config.project
      } else if (window.location.search.includes('PROJECT=')) {
        projectName = new URLSearchParams(window.location.search).get('PROJECT')
      }
      
      if (!projectName) {
        throw new Error('No s\'ha trobat el projecte')
      }
      
      const params = new URLSearchParams({
        VERSION: '1.1.0',
        SERVICE: 'WFS',
        REQUEST: 'GetFeature',
        OUTPUTFORMAT: 'GeoJSON',
        MAXFEATURES: 1000,
        TYPENAME: layerName
      })
      
      const url = `/api/map/ows/${projectName}?${params.toString()}`
      console.log('🔍 [loadLayerFeaturesForSearch] URL:', url)
      
      const response = await this.http.post(url)
      
      if (!response.data || !response.data.features) {
        throw new Error('No s\'han trobat features a la resposta WFS')
      }
      
      // Convertir GeoJSON a features d'OpenLayers
      console.log('✅ Convertint GeoJSON a features...', response.data.features.length)
      
      const format = new GeoJSON()
      const mapProjection = this.map.getView().getProjection().getCode()
      const features = format.readFeatures(response.data, {
        featureProjection: mapProjection
      })
      
      console.log('✅ Features convertides:', features.length)
      return features
      
    } catch (error) {
      console.error('❌ Error carregant les dades:', error)
      throw error
    }
  }
}

// Exportar una instancia singleton del servicio
let instance = null

export function createSearchDataPreloadService(http, map, store) {
  if (!instance) {
    instance = new SearchDataPreloadService(http, map, store)
  }
  return instance
}