import Vue from 'vue'
import Vuex from 'vuex'
import attributeTable from './attribute-table'
import HTTP from '@/client'
Vue.use(Vuex)

const generateUUID = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC

  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return (
    hex.slice(0, 8) + '-' +
    hex.slice(8, 12) + '-' +
    hex.slice(12, 16) + '-' +
    hex.slice(16, 20) + '-' +
    hex.slice(20)
  );
}

function layersList (node) {
  return node.layers ? [].concat(...node.layers.map(layersList)) : [node]
}

function filterGroups (node) {
  return node.layers ? [node].concat(...node.layers.map(filterGroups)) : []
}

const createUrl = (baseUrl, params = {}) => {
  const url = new URL(baseUrl, location.origin)
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]))
  return url
}

const getJsonCategoriesUrl = (layername, categoriesUrl) => {
  categoriesUrl.searchParams.set('LAYER', layername)
  return categoriesUrl.href
}

const jsonCategoriesParams = {
  SERVICE: 'WMS',
  VERSION: '1.1.1',
  REQUEST: 'GetLegendGraphic',
  FORMAT: 'application/json',
}

function getPropAndVal(node) {
  const prop =
    node.getElementsByTagName("ogc:PropertyName")[0]?.textContent ||
    node.getElementsByTagName("PropertyName")[0]?.textContent;

  const val =
    node.getElementsByTagName("ogc:Literal")[0]?.textContent ||
    node.getElementsByTagName("Literal")[0]?.textContent;

  return {
    prop: `"${prop}"`,
    val: `'${val}'`
  };
}

function parseNode(node) {

  switch (node.localName) {

    case "Or": {
      const children = [...node.children]
        .map(parseNode)
        .filter(Boolean)
        .map(c => ` ( ${c} ) `);

      return children.join(" OR ");
    }

    case "And": {
      const children = [...node.children]
        .map(parseNode)
        .filter(Boolean)
        .map(c => ` ( ${c} ) `);

      return children.join(" AND ");
    }

    case "PropertyIsEqualTo": {
      const { prop, val } = getPropAndVal(node);
      return `${prop} = ${val}`;
    }

    case "PropertyIsGreaterThan": {
      const { prop, val } = getPropAndVal(node);
      return `${prop} > ${val}`;
    }

    case "PropertyIsGreaterThanOrEqualTo": {
      const { prop, val } = getPropAndVal(node);
      return `${prop} >= ${val}`;
    }

    case "PropertyIsLessThan": {
      const { prop, val } = getPropAndVal(node);
      return `${prop} < ${val}`;
    }

    case "PropertyIsLessThanOrEqualTo": {
      const { prop, val } = getPropAndVal(node);
      return `${prop} <= ${val}`;
    }

    default:
      console.warn("Nodo OGC no soportado:", node.localName);
      return "";
  }
}

async function getCategoryTreeValues(layer, urlBase, jsonData) {

  const url = createUrl(urlBase, {
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetStyles',
    LAYERS: layer.name
  })
    // `http://localhost:8080/api/map/ows/nexus/cens_locals_arbre?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetStyles&LAYERS=${layer.name}`
  const xmlText = await fetch(url.href).then(r => r.text())
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'application/xml')
  const prop = xml.querySelector('ogc\\:PropertyName, PropertyName')

  const categoryList = [];
  if (prop?.textContent && layer.queryable) {
    const rules = xml.querySelectorAll('se\\:Rule, Rule');

    const availableSymbols = [...(jsonData?.nodes?.[0]?.symbols || [])];

    rules.forEach(rule => {

      const hasVisualSymbolizer = rule.querySelector(
        'se\\:PointSymbolizer, se\\:PolygonSymbolizer, se\\:LineSymbolizer, PointSymbolizer, PolygonSymbolizer, LineSymbolizer'
      );

      if (!hasVisualSymbolizer) return;

      const titleNode = rule.querySelector('se\\:Name, Name');
      const filterNode = rule.querySelector('ogc\\:Filter, Filter');

      if (!filterNode) return;

      const rootFilter = filterNode.firstElementChild;
      const filterString = ` ( ${parseNode(rootFilter)} ) `;
      const title = titleNode?.textContent;

      const symbolIndex = availableSymbols.findIndex(
        s => s.title === title
      );

      if (symbolIndex !== -1 && title) {

        const icon = availableSymbols[symbolIndex].icon;
        availableSymbols.splice(symbolIndex, 1);

        categoryList.push({
          title,
          icon,
          visible: true,
          propertyName: prop?.textContent || null,
          filterString,
          customHash: generateUUID()
        });
      }
    });
  }

  return {
    categoryList,
    propertyName: prop?.textContent
  }
}

export function filterLayers (items, test) {
  const list = []
  items.forEach(item => {
    if (item.layers) {
      const children = filterLayers(item.layers, test)
      if (children.length) {
        list.push({
          ...item,
          layers: children
        })
      }
    } else if (test(item)) {
      list.push(item)
    }
  })
  return list
}

export default new Vuex.Store({
  strict: process.env.NODE_ENV === 'development',
  modules: {
    attributeTable
  },
  state: {
    app: null,
    user: null,
    project: null,
    activeTool: null,
    showLogin: false,
    baseLayerName: null,
    location: null
  },
  mutations: {
    app (state, app) {
      state.app = app
    },
    user (state, user) {
      state.user = user
    },
    project (state, project) {
      if (!project) {
        state.project = null
        return
      }
      const { base_layers: baseLayers = [], layers = [] } = project
      layersList({ layers }).forEach(l => Vue.set(l, 'opacity', 255))
      const overlaysTree = filterLayers(layers, l => !l.hidden)
      const groups = [].concat(...overlaysTree.map(filterGroups))
      groups.filter(g => !g.virtual_layer).forEach(g => Vue.set(g, 'visible', true))
      groups.filter(g => g.virtual_layer).forEach(g => {
        const layers = layersList(g)
        const visible = layers.some(l => l.visible)
        g.visible = visible // Vue.set(g, 'visible', visible)
        // updates layers visibility for initial map rendering
        layers.forEach(l => l.visible = visible)
      })

      const overlaysList = layersList({ layers })
      const projectData = {
        config: project,
        baseLayers: {
          groups: [].concat(...baseLayers.map(filterGroups)),
          tree: baseLayers,
          list: layersList({ layers: baseLayers })
        },
        overlays: {
          groups,
          tree: overlaysTree,
          list: overlaysList,
          byName:overlaysList.reduce((t, l) => (t[l.name] = l, t), {})
        }
      }
      projectData.overlays.list.filter(l => l.relations?.length).forEach(l => {
        l.relations = l.relations.filter(r => {
          const rlayer = projectData.overlays.byName[r.referencing_layer]
          return rlayer
            && r.referenced_fields.every(field => l.attributes?.some(a => a.name === field))
            && r.referencing_fields.every(field => rlayer.attributes?.some(a => a.name === field))
        })
      })
      state.project = projectData
    },
    activeTool (state, name) {
      state.activeTool = name
    },
    visibleBaseLayer (state, name) {
      state.baseLayerName = name
    },
    groupVisibility (state, { group, visible }) {
      group.visible = visible
      if (group.virtual_layer) {
        layersList(group).forEach(l => l.visible = visible)
      }
    },
    layerVisibility (state, { layer, visible }) {
      const group = state.project.overlays.groups.find(g => g.layers.includes(layer))
      if (group?.mutually_exclusive) {
        const offLayers = group.layers.filter(l => l.visible && l !== layer)
        offLayers.forEach(l => l.visible = false)
      }
      layer.visible = visible
    },
    visibleLayers (state, layersNames) {
      state.project.overlays.list
        .filter(l => !l.hidden) // hidden layers should be always visible
        .forEach(l => {
          l.visible = layersNames.includes(l.name)
        })
    },
    layerOpacity (state, { layer, opacity }) {
      layer.opacity = opacity
    },
    showLogin (state, value) {
      state.showLogin = value
    },
    location (state, location) {
      state.location = location
    },
    setLayerExternalData(state, { layer, data, propertyName }) {
      Vue.set(layer, 'categoryList', data)
      Vue.set(layer, 'propertyName', propertyName)
    },
    setCategoryVisibility(state, { mainLayer, categoryHash, visible }) {
      const category = mainLayer.categoryList.find(c => c.customHash === categoryHash)
      if (category) {
        category.visible = visible
      }
    }
  },
  actions: {
    async loadOverlayData({ state, commit }) {
      if (!state.project) return
      const categoriesUrl = createUrl(state.project.config.ows_url, jsonCategoriesParams)

      const tree = state.project.overlays.tree

      async function fetchLayerData(layer) {
        if (layer.layers) {
          await Promise.all(layer.layers.map(fetchLayerData))
        } else {
          try {
            const response = await HTTP.get(getJsonCategoriesUrl(layer.name, categoriesUrl))
            const categoryTreeValues = await getCategoryTreeValues(layer, state.project.config.ows_url, response.data)
            commit('setLayerExternalData', { layer, data: categoryTreeValues.categoryList, propertyName: categoryTreeValues.propertyName })
          } catch (err) {
            console.warn(`Error cargando datos de ${layer.name}`, err.message)
          }
        }
      }

      await Promise.all(tree.map(fetchLayerData))
    },
  },
  getters: {
    visibleBaseLayer: state => {
      return state.project?.baseLayers?.list.find(l => l.name === state.baseLayerName)
    },
    visibleLayers: state => {
      if (!state.project) {
        return []
      }
      const { groups, list: layers } = state.project.overlays
      const excluded = [].concat(...groups.filter(g => !g.visible).map(layersList))
      // layers group
      const included = [].concat(...groups.filter(g => g.virtual_layer && g.visible).map(layersList))
      return layers.filter(l => l.drawing_order > -1 && (included.includes(l) || (l.visible && !excluded.includes(l))))
    }
  }
})
