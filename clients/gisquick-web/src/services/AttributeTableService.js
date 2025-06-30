export class AttributeTableService {
  constructor(store) {
    this.store = store;
  }

  /**
   * Simula l'obertura de la taula d'atributs per una capa
   */
  async simulateAttributeTableOpen(layerName) {
    const projectLayers = this.store.state.project?.overlays?.list || [];
    const targetLayer = projectLayers.find((layer) => layer.name === layerName);

    if (!targetLayer) {
      console.warn(`⚠️ Capa no trobada: ${layerName}`);
      return false;
    }

    if (!targetLayer.visible) {
      this.store.commit('layerVisibility', { layer: targetLayer, visible: true });
    }

    this.store.commit('attributeTable/layer', targetLayer);

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (this.store.state.attributeTable.features.length > 0) {
      return true;
    }

    console.log('⚠️ Carregant dades via WFS...');
    return false;
  }
}