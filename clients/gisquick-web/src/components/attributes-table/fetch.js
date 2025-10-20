import isEqual from 'lodash/isEqual'
import debounce from 'lodash/debounce'
import { fromExtent } from 'ol/geom/Polygon'

import { layerFeaturesQuery } from '@/map/featureinfo'
import { ShallowArray } from '@/utils'
import FeaturesReader from './features.js'

export default {
  // requires: $map, project, layer, layerFilters/filters, sortBy, pagination, visibleAreaFilter, ...
  mixins: [FeaturesReader],
  data () {
    return {
      loading: false,
      loadingError: false,
      lastQueryParams: null
    }
  },
  computed: {
    activeFilters () {
      return Object.entries(this.layerFilters || this.filters)
        .filter(([_, filter]) => filter.active && filter.comparator && filter.valid)
        .map(([name, filter]) => ({
          attribute: name,
          operator: filter.comparator,
          value: filter.value
        }))
    }
  },
  watch: {
    activeFilters (val, old) {
      if (!isEqual(val, old)) {
        this.fetchFeatures()
      }
    },
    limit () {
      this.fetchFeatures(1, true)
    },
    visibleAreaFilter () {
      this.fetchFeatures()
    },
    sortBy (n, o) {
      this.fetchFeatures(this.pagination?.page)
    },
    layer: {
      immediate: true,
      handler (layer) {
        if (layer) {
          this.fetchFeatures()
        }
      }
    }
  },
  methods: {
    getFeaturesQueryParams () {
      let geom = null
      if (this.visibleAreaFilter) {
        const mapProjection = this.$map.getView().getProjection().getCode()
        geom = fromExtent(this.$map.ext.visibleAreaExtent()).transform(mapProjection, this.layer.projection)
      }
      return { geom, filters: this.activeFilters }
    },
    async fetchRelationsFeatures (features) {
      const relationsToFetch = this.layer.relations.filter(r => r.infopanel_view !== 'hidden')

      const tasks = relationsToFetch.map(async rel => {
        const filters = rel.referencing_fields.map((field, i) => ({
          attribute: field,
          operator: 'IN',
          value: features.map(f => f.get(rel.referenced_fields[i]))
        }))
        const layer = this.project.overlays.byName[rel.referencing_layer]
        const query = layerFeaturesQuery(layer, { filters })
        const params = {
          'VERSION': '1.1.0',
          'SERVICE': 'WFS',
          'REQUEST': 'GetFeature',
          'OUTPUTFORMAT': 'GeoJSON'
        }
        const headers = { 'Content-Type': 'text/xml' }
        const { data } = await this.$http.post(this.project.config.ows_url, query, { params, headers })
        return ShallowArray(this.readFeatures(data, layer))
        // return features
      })
      const results = await Promise.all(tasks)
      features.forEach(feature => {
        if (!feature._relationsData) {
          feature._relationsData = {}
        }
        relationsToFetch.forEach((r, i) => {
          feature._relationsData[r.name] = results[i].filter(rf => r.referencing_fields.every((field, j) => rf.get(field) == feature.get(r.referenced_fields[j])))
        })
      })
    },
    _setFeatures (data) {}, // to override
    findLayerInStore(store, clickedLayer) {
      const layers = store.state.project?.config?.layers || []

      function recursiveSearch(layerList) {
        for (const layer of layerList) {
          if (layer.source) {
            const sameSource =
              layer.source.layername === clickedLayer.source?.layername &&
              layer.source.file === clickedLayer.source?.file

            if (sameSource) return layer
            if (layer.name === clickedLayer.name) return layer
          }

          if (Array.isArray(layer.layers)) {
            const found = recursiveSearch(layer.layers)
            if (found) return found
          }
        }
        return null
      }

      return recursiveSearch(layers)
    },
    setMockData(currentStoredLayer, features) {
      currentStoredLayer.actions = [
        {
          "id": "{8276dfb0-e92b-4df8-b1af-2727ab29fe2b}",
          "name": "Obrir imatge URL",
          "action_type": "5",
          "action_text": "[%URL_IMATGE%]",
          "short_title": "obrir_url",
          "layer_id": "cens_locals_web_15753b44_dfdf_4ad0_8ee2_77f8e7098333"
        },
        {
          "id": "{4bb7544c-1787-4847-b010-9975b9c8cf3ec}",
          "name": "Obrir imatge FILE",
          "action_type": "7",
          "action_text": "[%PATH_IMATGE%]",
          "short_title": "Imatge_FILE",
          "layer_id": "cens_locals_web_15753b44_dfdf_4ad0_8ee2_77f8e7098333"
        },
        {
          "id": "{4bb7544c-1787-4847-b010-9975b9c8cf3e}",
          "name": "Obrir imatge FILE",
          "action_type": "7",
          "action_text": "https://www.youtube.com/",
          "short_title": "Imatge_FILE",
          "layer_id": "cens_locals_web_15753b44_dfdf_4ad0_8ee2_77f8e7098333"
        },
        {
          "id": "{4bb7544c-1787-4847-b010-9975b9c8cf3ee}",
          "name": "Obrir document FILE",
          "action_type": "5",
          "action_text": "[%PATH_IMATGE2%]",
          "short_title": "Document",
          "layer_id": "cens_locals_web_15753b44_dfdf_4ad0_8ee2_77f8e7098333"
        }
      ]

      features.forEach(feature => {
        feature.values_.URL_IMATGE = 'google.com'
        feature.values_.PATH_IMATGE = 'wikipedia.com'
        feature.values_.PATH_IMATGE2 = 'https://yahoo.com'
      })

      features[0].values_.URL_IMATGE = 'https://bing.com'
    },
    setFilteredActionsFeatures(currentStoredLayer, features) {
      features.forEach(feature => {
        feature.values_.actions = []
        currentStoredLayer.actions?.forEach(action => {
          const valueAction = action.action_text
          const match = valueAction.match(/^\[\%(.*?)\%\]$/)

          let actionName
          if (match) {
            const variableName = match[1]
            actionName = feature.values_[variableName]
          } else {
            actionName = valueAction
          }

          feature.values_.actions.push({ ...action, filtered_action: actionName })
        })
      })
    },
    fetchFeatures: debounce(async function (page = 1, lastQuery = false) {
    // async fetchFeatures (page = 1, lastQuery = false) {
      // console.log('fetching features, page:', page, 'sort:', JSON.stringify(this.sortBy))
      let query
      let queryParams
      if (lastQuery) {
        query = this.pagination.query
      } else {
        const { geom, filters } = this.getFeaturesQueryParams()
        query = layerFeaturesQuery(this.layer, { geom, filters, sortBy: this.sortBy })
        queryParams = { geom, filters }
      }

      const baseParams = {
        VERSION: '1.1.0',
        SERVICE: 'WFS',
        REQUEST: 'GetFeature',
        OUTPUTFORMAT: 'GeoJSON'
      }

      const headers = { 'Content-Type': 'text/xml' }
      let geojson, featuresCount
      this.loading = true
      this.loadingError = false
      try {
        let params = { ...baseParams, resultType: 'hits' }
        let resp = await this.$http.post(this.project.config.ows_url, query, { params, headers })
        // fix invalid geojson from QGIS server (missing ',')
        try {
          featuresCount = JSON.parse(resp.data.replace(/"\n/g, '",\n')).numberOfFeatures
        } catch (err) {
          featuresCount = resp.data.numberOfFeatures
        }

        params = {
          ...baseParams,
          STARTINDEX: Math.max(0, (page - 1) * this.limit),
          MAXFEATURES: this.limit
        }
        resp = await this.$http.post(this.project.config.ows_url, query, { params, headers })
        geojson = resp.data
      } catch (e) {
        console.error(e)
        this.loadingError = this.$gettext('Failed to load data')
        return
      } finally {
        this.loading = false
      }

      // const features = ShallowArray(parser.readFeatures(geojson, { featureProjection: mapProjection }))
      const features = Object.freeze(this.readFeatures(geojson, this.layer))
      if (this.fetchRelations && this.layer.relations) {
        this.fetchRelationsFeatures(features)
      }
      const pagination = {
        query,
        page,
        rowsPerPage: this.limit,
        totalItems: featuresCount,
        sortBy: { ...this.sortBy },
        queryParams
      }

      const currentStoredLayer = this.findLayerInStore(this.$store, this.layer)

      // ! Tenim això per si estem a localhost que sempre posi dades mock, dins del bloc if podem afegir o treure accions per testing!
      if (currentStoredLayer) {
        if (window.location.href.includes("localhost")) {
          this.setMockData(currentStoredLayer, features)
        }

        this.setFilteredActionsFeatures(currentStoredLayer, features)
      }
      this._setFeatures({
        features,
        pagination,
        queryParams,
        sortBy: { ...this.sortBy }
      })
    }, 20)
  }
}
