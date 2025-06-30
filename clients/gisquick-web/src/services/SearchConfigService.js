export class SearchConfigService {
  /**
   * Parseja la configuració de cerca específica (qV_search)
   */
  parseQVSearch(qvSearch, layerName) {
    try {
      console.log('🔍 [parseQVSearch] Processant:', { qvSearch, layerName });

      if (!qvSearch || typeof qvSearch !== 'string') {
        console.warn('🔍 [parseQVSearch] qvSearch invàlid');
        return null;
      }

      const fieldMatch = qvSearch.match(/field="([^"]+)"/);
      const fieldTextMatch = qvSearch.match(/fieldText="([^"]+)"/);
      const descMatch = qvSearch.match(/desc="([^"]+)"/);

      if (!fieldMatch) {
        console.warn(`🔍 [parseQVSearch] No s'ha trobat el camp per ${layerName}`);
        return null;
      }

      return {
        id: layerName,
        layerName,
        field: fieldMatch[1],
        fieldText: fieldTextMatch ? fieldTextMatch[1] : layerName,
        desc: descMatch ? descMatch[1] : `Cercar per ${fieldTextMatch ? fieldTextMatch[1] : 'camp'}`,
      };
    } catch (error) {
      console.error('🔍 [parseQVSearch] Error:', error);
      return null;
    }
  }

  /**
   * Inicialitza les cerques específiques a partir de les capes del projecte
   */
  initSpecificSearches(projectLayers) {
    const specificSearches = [];
    const searchTypes = [{ value: 'normal', text: 'Cerca normal' }];

    if (projectLayers && Array.isArray(projectLayers)) {
      projectLayers.forEach((layer) => {
        if (layer.qV_search) {
          const searchConfig = this.parseQVSearch(layer.qV_search, layer.name);
          if (searchConfig) {
            specificSearches.push(searchConfig);
            searchTypes.push({
              value: searchConfig.id,
              text: searchConfig.fieldText || searchConfig.id,
            });
          }
        }
      });
    }

    return { specificSearches, searchTypes };
  }
}