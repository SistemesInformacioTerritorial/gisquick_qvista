import GeoJSON from 'ol/format/GeoJSON'
import { getProjection } from 'ol/proj'
import { SearchConfigService } from './SearchConfigService';
import { SearchDataPreloadService } from './SearchDataPreloadService';

// filepath: c:\repo\gisquick-qvista\clients\gisquick-web\src\services\SpecificSearchService.js
export class SpecificSearchService {
  constructor(store, http, map) {
    if (!store || !http || !map) {
      throw new Error('Falten paràmetres per inicialitzar SpecificSearchService')
    }
    
    this.store = store
    this.http = http
    this.map = map
  }

  // ACTUALITZAR: Textos en català
  parseQVSearch(qvSearch, layerName) {
    try {
      console.log('🔍 [parseQVSearch] Processant:', { qvSearch, layerName })
      
      if (!qvSearch || typeof qvSearch !== 'string') {
        console.log('🔍 [parseQVSearch] qvSearch invàlid')
        return null
      }
      
      const fieldMatch = qvSearch.match(/field="([^"]+)"/)
      const fieldTextMatch = qvSearch.match(/fieldText="([^"]+)"/)
      const descMatch = qvSearch.match(/desc="([^"]+)"/)
      
      if (!fieldMatch) {
        console.log('🔍 [parseQVSearch] No s\'ha trobat el camp')
        return null
      }
      
      const config = {
        id: layerName,
        layerName: layerName,
        field: fieldMatch[1],
        fieldText: fieldTextMatch ? fieldTextMatch[1] : layerName,
        desc: descMatch ? descMatch[1] : `Cercar per ${fieldTextMatch ? fieldTextMatch[1] : 'camp'}`,
      }
      
      console.log('🔍 [parseQVSearch] Configuració creada:', config)
      return config
    } catch (err) {
      console.error('🔍 [parseQVSearch] Error:', err)
      return null
    }
  }

  // ACTUALITZAR: Textos en català
  initSpecificSearches(projectLayers) {
    const specificSearches = []
    const searchTypes = [{ value: 'normal', text: 'Cerca normal' }]
    
    if (projectLayers && Array.isArray(projectLayers)) {
      projectLayers.forEach((layer) => {
        if (layer && layer.qV_search) {
          const searchConfig = this.parseQVSearch(layer.qV_search, layer.name)
          if (searchConfig) {
            specificSearches.push(searchConfig)
            searchTypes.push({
              value: searchConfig.id,
              text: searchConfig.fieldText || searchConfig.id
            })
          }
        }
      })
    }

    return { specificSearches, searchTypes }
  }

  // NOU: Mètode per simular el click del menú lateral
  async simulateAttributeTableOpen(layerName) {
    try {
      console.log('🔄 [simulateAttributeTableOpen] Obrint taula per:', layerName)
      
      // 1. Buscar la capa al projecte
      const projectLayers = this.store.state.project?.overlays?.list || []
      const targetLayer = projectLayers.find(layer => layer.name === layerName)
      
      if (!targetLayer) {
        console.warn('⚠️ Capa no trobada:', layerName)
        return false
      }

      console.log('✅ Capa trobada:', targetLayer.name)
      
      // 2. Activar la capa si no està visible
      if (!targetLayer.visible) {
        console.log('🔧 Activant visibilitat de la capa...')
        this.store.commit('layerVisibility', { layer: targetLayer, visible: true })
      }
      
      // 3. Obrir la taula d'atributs (això carrega automàticament les dades)
      console.log('🔧 Obrint taula d\'atributs...')
      this.store.commit('attributeTable/layer', targetLayer)
      
      // 4. Comprovar si ja tenim dades
      if (this.store.state.attributeTable.features.length > 0) {
        console.log('✅ Dades ja carregades:', this.store.state.attributeTable.features.length, 'features')
        return true
      }
      
      // 5. Si no, carregar les dades manualment via WFS
      console.log('🔄 Carregant dades manualment...');
      
      // Esperar una mica més (augmentar el temps d'espera)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 6. Verificar que s'han carregat
      const dataCarregada = this.store.state.attributeTable.features.length > 0;
      
      if (dataCarregada) {
        console.log('✅ Dades carregades correctament:', this.store.state.attributeTable.features.length, 'features');
        return true;
      } else {
        // 7. Si encara no estan carregades, intentem carregar-les manualment
        console.log('⚠️ Carregant dades via WFS...');
        try {
          // Fer una sol·licitud WFS directa
          const result = await this.loadLayerFeaturesWFS(layerName);
          
          // Esperar un moment més per assegurar-nos que tot està actualitzat
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Verificar un cop més
          const featuresCount = this.store.state.attributeTable.features.length;
          console.log('🔍 Features en store després de càrrega manual:', featuresCount);
          
          return featuresCount > 0;
        } catch (err) {
          console.error('❌ Error carregant via WFS:', err);
          return false;
        }
      }
    } catch (error) {
      console.error('❌ Error simulant obertura taula:', error)
      return false
    }
  }

  // Mètode auxiliar per carregar features mitjançant WFS si falla tot el resta
  async loadLayerFeaturesWFS(layerName) {
    try {
      // Obtenir el nom del projecte correctament
      let projectName = 'int/cultureta';  // Valor per defecte
      
      // Intentar obtenir el projectName d'altres formes
      if (this.store.state.project?.config?.project) {
        projectName = this.store.state.project.config.project;
      } else if (window.location.search.includes('PROJECT=')) {
        projectName = new URLSearchParams(window.location.search).get('PROJECT');
      }
      
      if (!projectName) {
        throw new Error('No s\'ha trobat el projecte');
      }
      
      console.log('🔍 [loadLayerFeaturesWFS] Projecte:', projectName);
      
      const params = new URLSearchParams({
        VERSION: '1.1.0',
        SERVICE: 'WFS',
        REQUEST: 'GetFeature',
        OUTPUTFORMAT: 'GeoJSON',
        MAXFEATURES: 1000,
        TYPENAME: layerName
      });
      
      const url = `/api/map/ows/${projectName}?${params.toString()}`;
      console.log('🔍 [loadLayerFeaturesWFS] URL:', url);
      
      const response = await this.http.post(url);
      
      if (!response.data || !response.data.features) {
        throw new Error('No s\'han trobat features a la resposta WFS');
      }
      
      // IMPORTANT: Convertir GeoJSON a features d'OpenLayers
      console.log('✅ Convertint GeoJSON a features...', response.data.features.length);
      
      const format = new GeoJSON();
      const mapProjection = this.map.getView().getProjection().getCode();
      const features = format.readFeatures(response.data, {
        featureProjection: mapProjection
      });
      
      console.log('✅ Features convertides:', features.length);
      
      // IMPORTANT: Actualitzar el store amb les features carregades
      const currentLayer = this.store.state.attributeTable.layer;
      if (currentLayer && currentLayer.name === layerName) {
        console.log('🔧 Actualizando store con', features.length, 'features per la capa:', layerName);
        this.store.commit('attributeTable/features', features);
      } else {
        console.warn('⚠️ La capa actual no coincide con la solicitada:', layerName);
      }
      
    } catch (error) {
      console.error('❌ Error carregant les dades via WFS:', error);
      throw error;
    }
  }

  // NOU: Mètode principal per crear el servei de cerca
  createSimpleLayerSearchService(searchConfig) {
    return {
      autocomplete: async (text) => {
        if (text.length < 2) return []
        
        try {
          console.log('🔍 [autocomplete] Cercant:', text, 'a la capa:', searchConfig.layerName)
          
          // 1. Assegurar que les dades estan carregades
          const dataCarregada = await this.simulateAttributeTableOpen(searchConfig.layerName)
          
          if (!dataCarregada) {
            return [{
              text: `No s'han pogut carregar les dades de "${searchConfig.layerName}"`,
              info: true,
              error: true
            }]
          }
          
          // 2. Cercar a les dades carregades
          return this.searchInStoreData(searchConfig, text)
          
        } catch (error) {
          console.error('❌ Error en cerca específica:', error)
          return [{
            text: `Error: ${error.message}`,
            info: true,
            error: true
          }]
        }
      },
      
      getFeature: async (item) => {
        if (item.info) return null
        return item.originalFeature || item.feature
      }
    }
  }

  // NOU: Cerca dins les dades del store
  searchInStoreData(searchConfig, text) {
    const suggestions = [];
    const searchText = text.toLowerCase();
    
    console.log('🔍 [searchInStoreData] Cercant:', searchText, 'al camp:', searchConfig.field);
    
    // Obtenir features des del nou store de cerca
    console.log('🔍 Accediendo a features en el store per la capa:', searchConfig.layerName);
    const features = this.store.state.searchData?.layerData?.[searchConfig.layerName] || [];
    console.log('🔍 Features encontrades:', features.length);
    
    if (!features || features.length === 0) {
      console.log('⚠️ No hi ha features al store per aquesta capa');
      
      return [{
        text: `No s'han pogut carregar les dades de "${searchConfig.layerName}"`,
        info: true,
        error: true
      }];
    }
    
    let trobats = 0;
    // Cerca a les dades precàrregades
    features.forEach((feature) => {
      if (trobats >= 10) return;
      
      const properties = feature.getProperties();
      const fieldValue = properties[searchConfig.field];
      
      if (fieldValue) {
        const fieldValueLower = fieldValue.toString().toLowerCase();
        if (fieldValueLower.includes(searchText)) {
          suggestions.push({
            text: fieldValue.toString(),
            originalFeature: feature,
            feature,
            properties
          });
          trobats++;
        }
      }
    });
    
    if (trobats === 0) {
      return [{
        text: `No s'han trobat resultats per "${text}"`,
        info: true,
        error: false
      }];
    }
    
    return suggestions;
  }
  
  // Afegir aquesta funció a la classe SpecificSearchService
  normalizeLayerName(name) {
    // Normalitzar els noms de capa per comparacions consistents
    return name ? name.trim().toLowerCase() : '';
  }

  // Nou mètode per precàrregar dades de capes amb cerca
  async preloadSearchLayersData(projectLayers) {
    if (!projectLayers || !Array.isArray(projectLayers)) return;
    
    console.log('🔄 Preloading data for layers with search:', 
      projectLayers.filter(l => l.qV_search).length);
    
    // Crea un store per guardar les dades de cerca
    if (!this.store.state.searchData) {
      console.log('🔄 Registrando módulo searchData en el store...');
      this.store.registerModule('searchData', {
        namespaced: true,
        state: { layerData: {} },
        mutations: {
          setLayerData(state, { layerName, features }) {
            state.layerData = { 
              ...state.layerData, 
              [layerName]: features 
            };
            console.log(`✅ Dades guardades al searchData: ${features.length} features per ${layerName}`);
          }
        }
      });
    }
    
    // Carregar dades de cada capa amb cerca
    for (const layer of projectLayers) {
      if (layer.qV_search) {
        console.log('🔄 Preloading', layer.name, '...');
        try {
          // Utilitzar el mateix mètode que ja tenim per WFS
          const features = await this.loadLayerFeaturesForSearch(layer.name);
          if (features && features.length) {
            this.store.commit('searchData/setLayerData', { 
              layerName: layer.name, 
              features 
            });
          }
        } catch (error) {
          console.error('❌ Error precarregant', layer.name, ':', error);
        }
      }
    }
  }

  // Nou mètode específic per carregar dades per cerca
  async loadLayerFeaturesForSearch(layerName) {
    try {
      // Obtenir el nom del projecte
      let projectName = 'int/cultureta';
      
      if (this.store.state.project?.config?.project) {
        projectName = this.store.state.project.config.project;
      } else if (window.location.search.includes('PROJECT=')) {
        projectName = new URLSearchParams(window.location.search).get('PROJECT');
      }
      
      if (!projectName) {
        throw new Error('No s\'ha trobat el projecte');
      }
      
      const params = new URLSearchParams({
        VERSION: '1.1.0',
        SERVICE: 'WFS',
        REQUEST: 'GetFeature',
        OUTPUTFORMAT: 'GeoJSON',
        MAXFEATURES: 1000,
        TYPENAME: layerName
      });
      
      const url = `/api/map/ows/${projectName}?${params.toString()}`;
      const response = await this.http.post(url);
      
      if (!response.data || !response.data.features) {
        throw new Error('No s\'han trobat features a la resposta WFS');
      }
      
      // Convertir GeoJSON a features d'OpenLayers
      const format = new GeoJSON();
      const mapProjection = this.map.getView().getProjection().getCode();
      const features = format.readFeatures(response.data, {
        featureProjection: mapProjection
      });
      
      console.log('✅ Features convertides:', features.length);
      
      // Guardar les features al store per la capa corresponent
      console.log('🔍 Guardando features en el store para la capa:', layerName);
      this.store.commit('searchData/setLayerData', { layerName, features });
      
      return features;
      
    } catch (error) {
      console.error('❌ Error carregant les dades:', error);
      throw error;
    }
  }

  async searchInWFS(searchConfig, text) {
    try {
      const searchText = text.toLowerCase();
      console.log('🔍 [searchInWFS] Cercant:', searchText, 'al camp:', searchConfig.field);

      // Construir la solicitud XML
      const xmlRequest = `
        <GetFeature xmlns="http://www.opengis.net/wfs" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:gml="http://www.qgis.org/gml" xmlns:ogc="http://www.opengis.net/ogc">
          <wfs:Query typeName="${searchConfig.layerName}" xmlns:feature="http://www.qgis.org/gml">
            <ogc:Filter xmlns:ogc="http://www.opengis.net/ogc">
              <ogc:PropertyIsLike wildCard="%" singleChar="_" escapeChar="\\" matchCase="false">
                <ogc:PropertyName>${searchConfig.field}</ogc:PropertyName>
                <ogc:Literal>%${searchText}%</ogc:Literal>
              </ogc:PropertyIsLike>
            </ogc:Filter>
            <ogc:SortBy>
              <ogc:SortProperty>
                <ogc:PropertyName>ID</ogc:PropertyName>
                <ogc:SortOrder>asc</ogc:SortOrder>
              </ogc:SortProperty>
            </ogc:SortBy>
          </wfs:Query>
        </GetFeature>
      `;

      const url = `/api/map/ows/${this.store.state.project?.config?.project || 'int/cultureta'}`;
      console.log('🔍 [searchInWFS] URL:', url);

      // Realizar la solicitud al servicio WFS
      const response = await this.http.post(url, xmlRequest, {
        headers: {
          'Content-Type': 'application/xml',
        },
      });

      if (!response.data || !response.data.features) {
        console.warn('⚠️ No s\'han trobat features a la resposta WFS');
        return [{
          text: `No s'han trobat resultats per "${text}"`,
          info: true,
          error: false,
        }];
      }

      // Generar sugerencias a partir de les features
      const suggestions = response.data.features.map((feature) => ({
        text: feature.properties[searchConfig.field],
        feature,
        properties: feature.properties,
      }));

      return suggestions.length > 0 ? suggestions : [{
        text: `No s'han trobat resultats per "${text}"`,
        info: true,
        error: false,
      }];
    } catch (error) {
      console.error('❌ Error en cerca WFS:', error);
      return [{
        text: `Error: ${error.message}`,
        info: true,
        error: true,
      }];
    }
  }
}
this.specificSearchService = new SpecificSearchService(this.$store, this.$http, this.$map);