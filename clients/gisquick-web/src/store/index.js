import Vue from 'vue'
import Vuex from 'vuex'
import attributeTable from './attribute-table'
import HTTP from '@/client'
Vue.use(Vuex)
import JSZip from 'jszip'

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

function getRotationFromQgs(xml) {
  const rotationNode = xml.querySelector('mapcanvas > rotation')
  const rotationNode2 = xml.querySelector('ProjectViewSettings').getAttribute('rotation')
  return rotationNode ? parseFloat(rotationNode.textContent) : parseFloat(rotationNode2)
}

function layersList(node) {
  return node.layers ? [].concat(...node.layers.map(layersList)) : [node]
}

function filterGroups(node) {
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

async function loadQgsXml(projectName, title) {
  // "http://localhost:8081/api/project/download/nexus/PPM_CategVariableContinua/PPM_CategVariableContinua_gpkg.qgs"
  // `http://localhost:8080/api/map/ows/nexus/CensLocals_accions?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetStyles&LAYERS=cens_locals_cens_locals_web`
  const baseUrl = `${window.location.origin}/api/project/download/${projectName}/`

  try {
    const res = await fetch(`${baseUrl}${title}.qgs`)
    if (res.ok) {
      const text = await res.text()
      return new DOMParser().parseFromString(text, 'application/xml')
    }
  } catch (e) { }

  const resQgz = await fetch(`${baseUrl}${title}.qgz`)
  if (!resQgz.ok) {
    throw new Error('No se encontró .qgs ni .qgz')
  }

  const blob = await resQgz.blob()
  const zip = await JSZip.loadAsync(blob)

  // buscar archivo .qgs dentro del qgz
  const qgsFileName = Object.keys(zip.files).find(f => f.endsWith('.qgs'))

  if (!qgsFileName) {
    throw new Error('El .qgz no contiene archivo .qgs')
  }

  const qgsText = await zip.files[qgsFileName].async('string')

  return new DOMParser().parseFromString(qgsText, 'application/xml')
}

const getEffectiveRenderer = (layerNode) => {

  const SUPPORTED_TYPES = [
    'RuleRenderer',
    'categorizedSymbol',
    'graduatedSymbol'
  ]

  // Buscar TODOS los renderer-v2 dentro del layer
  const allRenderers = [...layerNode.querySelectorAll('renderer-v2')]

  if (!allRenderers.length) return null

  // Buscar uno cuyo type esté soportado
  for (const r of allRenderers) {
    const type = r.getAttribute('type')

    if (SUPPORTED_TYPES.includes(type)) {
      return r
    }

    // Si es wrapper, comprobar si dentro hay uno soportado
    if (type === 'pointCluster') {
      const nested = r.querySelector('renderer-v2')
      if (nested && SUPPORTED_TYPES.includes(nested.getAttribute('type'))) {
        return nested
      }
    }
  }

  return null
}

async function getCategoryTreeValues(layer, qgsXml, jsonData) {

  const ruleTree = [];

  if (!layer.queryable) {
    return { ruleTree, propertyName: null }
  }

  // buscar layer en el qgs
  const mapLayers = qgsXml.querySelectorAll('maplayer')

  const layerNode = [...mapLayers].find(l =>
    l.querySelector('layername')?.textContent === layer.name || l.querySelector('shortname')?.textContent === layer.name
  )

  if (!layerNode) {
    return { ruleTree, propertyName: null }
  }

  const renderer = getEffectiveRenderer(layerNode) //layerNode.querySelector('renderer-v2')
  if (!renderer) {
    return { ruleTree, propertyName: null }
  }

  const availableSymbols = [...(jsonData?.nodes?.[0]?.symbols || [])]
  const rendererType = renderer.getAttribute('type')

  //* RULE RENDERER
  if (rendererType === 'RuleRenderer') {

    const rulesRoot = renderer.querySelector('rules')
    if (!rulesRoot) {
      return { ruleTree: [], propertyName: null }
    }

    function buildRuleNode(ruleNode, isParent = false) {

      const label = ruleNode.getAttribute('label')
      const filter = ruleNode.getAttribute('filter')
      const symbolAttr = ruleNode.getAttribute('symbol')

      const decodedFilter = filter
        ? filter.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        : null

      let icon = null

      if (symbolAttr !== null) {
        const symbolIndex = availableSymbols.findIndex(
          s => s.title === label
        )

        if (symbolIndex !== -1) {
          icon = availableSymbols[symbolIndex].icon
          availableSymbols.splice(symbolIndex, 1)
        }
      }

      const node = {
        id: generateUUID(),
        title: label || 'Sin etiqueta',
        icon,
        visible: true,
        isParentNode: isParent,
        filterString: decodedFilter ? ` ( ${decodedFilter} ) ` : null,
        customHash: generateUUID(),
        children: []
      }

      // SOLO hijos directos (no todos descendientes)
      const directChildren = [...ruleNode.children].filter(
        c => c.tagName === 'rule'
      )

      node.children = directChildren.map(child => buildRuleNode(child, false))

      return node
    }

    const rootRules = [...rulesRoot.children].filter(
      c => c.tagName === 'rule'
    )

    const ruleTree = rootRules.map(child => buildRuleNode(child, true))

    return {
      ruleTree,
      propertyName: null
    }
  }

  //* GRADUATED (RANGE)
  if (rendererType === 'graduatedSymbol') {

    const attr = renderer.getAttribute('attr')
    const ranges = renderer.querySelectorAll('range')

    ranges.forEach(range => {

      const lower = range.getAttribute('lower')
      const upper = range.getAttribute('upper')
      const label = range.getAttribute('label')

      if (!attr || lower == null || upper == null) return

      // construir filtro CQL equivalente
      const filterString = ` ( "${attr}" >= "${lower}" AND "${attr}" <= "${upper}" ) `

      const symbolIndex = availableSymbols.findIndex(
        s => s.title === label
      )

      const icon = availableSymbols[symbolIndex].icon
      availableSymbols.splice(symbolIndex, 1)

      ruleTree.push({
        title: label,
        icon,
        propertyName: null,
        visible: true,
        filterString,
        customHash: generateUUID()
      })
    })

    return {
      ruleTree,
      propertyName: attr
    }
  }

  //* CATEGORIZED
  if (rendererType === 'categorizedSymbol') {

    const attr = renderer.getAttribute('attr')
    const categories = renderer.querySelectorAll('category')

    categories.forEach(cat => {

      if (cat.getAttribute('render') === 'false') return

      const value = cat.getAttribute('value')
      const label = cat.getAttribute('label')

      if (!attr || value == null) return

      // Si es string → comillas
      // const isNumeric = !isNaN(value)

      const filterString = ` ( "${attr}" = "${value}" ) `

      const symbolIndex = availableSymbols.findIndex(
        s => s.title === label
      )
      const icon = availableSymbols[symbolIndex].icon
      availableSymbols.splice(symbolIndex, 1)

      ruleTree.push({
        title: label || value,
        icon,
        propertyName: null,
        visible: true,
        filterString,
        customHash: generateUUID()
      })
    })

    return {
      ruleTree,
      propertyName: attr
    }
  }

  return {
    ruleTree,
    propertyName: null
  }
}

export function filterLayers(items, test) {
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
    location: null,
    rotation: 0
  },
  mutations: {
    setRotation(state, rotation) {
      state.rotation = rotation
    },
    app(state, app) {
      state.app = app
    },
    user(state, user) {
      state.user = user
    },
    project(state, project) {
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
          byName: overlaysList.reduce((t, l) => (t[l.name] = l, t), {})
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
    activeTool(state, name) {
      state.activeTool = name
    },
    visibleBaseLayer(state, name) {
      state.baseLayerName = name
    },
    groupVisibility(state, { group, visible }) {
      group.visible = visible
      if (group.virtual_layer) {
        layersList(group).forEach(l => l.visible = visible)
      }
    },
    layerVisibility(state, { layer, visible }) {
      const group = state.project.overlays.groups.find(g => g.layers.includes(layer))
      if (group?.mutually_exclusive) {
        const offLayers = group.layers.filter(l => l.visible && l !== layer)
        offLayers.forEach(l => l.visible = false)
      }
      layer.visible = visible
    },
    visibleLayers(state, layersNames) {
      state.project.overlays.list
        .filter(l => !l.hidden) // hidden layers should be always visible
        .forEach(l => {
          l.visible = layersNames.includes(l.name)
        })
    },
    layerOpacity(state, { layer, opacity }) {
      layer.opacity = opacity
    },
    showLogin(state, value) {
      state.showLogin = value
    },
    location(state, location) {
      state.location = location
    },
    setLayerExternalData(state, { layer, data, propertyName }) {
      Vue.set(layer, 'ruleTree', data)
      Vue.set(layer, 'propertyName', propertyName)
    },
    setRuleVisibility(state, { rule }) {
      function setRecursive(node, value) {
        node.visible = value
        if (node.children?.length) {
          node.children.forEach(child => setRecursive(child, value))
        }
      }

      setRecursive(rule, !rule.visible)
    }
  },
  actions: {
    async loadOverlayData({ state, commit }) {
      if (!state.project) return
      const categoriesUrl = createUrl(state.project.config.ows_url, jsonCategoriesParams)

      const tree = state.project.overlays.tree
      const projectBaseName = state.project.config.ows_project.split('/')[1];
      const qgsXml = await loadQgsXml(window.project, projectBaseName);
      const rotation = getRotationFromQgs(qgsXml) || 0
      commit('setRotation', rotation)

      async function fetchLayerData(layer) {
        if (layer?.layers) {
          await Promise.all(layer.layers.map(fetchLayerData))
        } else {
          try {
            const response = await HTTP.get(getJsonCategoriesUrl(layer?.name, categoriesUrl))
            const categoryTreeValues = await getCategoryTreeValues(layer, qgsXml,response.data)
            commit('setLayerExternalData', { layer, data: categoryTreeValues.ruleTree, propertyName: categoryTreeValues.propertyName })
          } catch (err) {
            console.warn(`Error cargando datos de ${layer?.name}`, err.message)
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
