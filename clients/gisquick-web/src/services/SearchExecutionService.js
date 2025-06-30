export class SearchExecutionService {
  constructor(store) {
    this.store = store;
  }

  /**
   * Cerca dins les dades del `store`
   */
  searchInStoreData(searchConfig, text) {
    const features = this.store.state.searchData?.layerData?.[searchConfig.layerName] || [];
    const searchText = text.toLowerCase();
    const suggestions = [];

    features.forEach((feature) => {
      const properties = feature.getProperties();
      const fieldValue = properties[searchConfig.field]?.toString().toLowerCase();

      if (fieldValue?.includes(searchText)) {
        suggestions.push({ text: properties[searchConfig.field], feature, properties });
      }
    });

    return suggestions.length ? suggestions : [{ text: `No s'han trobat resultats per "${text}"`, info: true }];
  }
}