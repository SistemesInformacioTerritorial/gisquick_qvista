<template>
  <div
    v-if="enabled"
    class="search-tool dark f-row-ac"
    :class="{expanded}"
  >
    <v-btn class="toggle icon flat" @click="toggle">
      <v-icon name="magnifier"/>
    </v-btn>
    <div v-if="expanded" class="toolbar f-row-ac">
      <!-- Selector de tipo de búsqueda -->
      <v-select
        v-if="specificSearches.length > 0"
        class="search-type-select flat inline"
        :items="searchTypes"
        v-model="selectedSearchType"
        @input="onSearchTypeChange"
      />
      <v-autocomplete
        ref="autocomplete"
        :placeholder="currentPlaceholder"
        class="flat inline"
        :loading="loading"
        :error="error"
        :min-chars="1"
        :items="suggestions"
        highlight-fields="text"
        :value="result"
        id="cerca"
        @input="onInput"
        @text:update="onTextChangeDebounced"
        @keydown.enter="onEnter"
        @clear="clear"
      >
        <template v-slot:item="{ html }">
          <div class="item f-row f-grow">
            <div class="f-grow">
              <span class="address" v-html="html.text"/>
            </div>
          </div>
        </template>
        <template v-slot:error="{ error }">
          <div class="f-row-ac">
            <v-icon name="warning" color="red"/>
            <v-tooltip>{{ error }}</v-tooltip>
          </div>
        </template>
      </v-autocomplete>
      <features-viewer :features="features"/>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { mapState } from 'vuex'
import debounce from 'lodash/debounce'
import Point from 'ol/geom/Point'
import Feature from 'ol/Feature'
import { toLonLat, fromLonLat, transformExtent } from 'ol/proj'
import VAutocomplete from '@/ui/Autocomplete.vue'
import FeaturesViewer from '@/components/ol/FeaturesViewer.vue'

const HDMSRegex = /^(\d{1,2})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d{1})?)[\"″]\s*([NS])\s*(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d{1})?)[\"″]\s*([EW])$/
const LonLatRegex = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

function parseHDMS (input) {
  const parts = input.split(/[°'"′″\s]+/)
  const latDegrees = parseFloat(parts[0])
  const latMinutes = parseFloat(parts[1])
  const latSeconds = parseFloat(parts[2])
  const lonDegrees = parseFloat(parts[4])
  const lonMinutes = parseFloat(parts[5])
  const lonSeconds = parseFloat(parts[6])
  const latHemisphere = parts[3]
  const lonHemisphere = parts[7]
  const latitude = latDegrees + latMinutes / 60 + latSeconds / 3600
  const longitude = lonDegrees + lonMinutes / 60 + lonSeconds / 3600
  const finalLatitude = latHemisphere === 'S' ? -latitude : latitude
  const finalLongitude = lonHemisphere === 'W' ? -longitude : longitude
  return [finalLongitude, finalLatitude]
}

export default {
  name: 'search',
  components: { VAutocomplete, FeaturesViewer },
  props: {
    label: String
  },
  data() {
    return {
      suggestions: [],
      feature: null,
      expanded: false,
      loading: false,
      error: '',
      result: null,
      selectedSearchType: 'normal',
      specificSearches: [], // Almacenará las búsquedas específicas
      searchTypes: [
        { value: 'normal', text: this.$gettext('Búsqueda normal') }
      ],
      currentPlaceholder: ''
    }
  },
  computed: {
    ...mapState(['project']),
    config() {
      return this.project.config.search ?? {}
    },
    enabled() {
      return true // always enabled 
    },
    service() {
      if (this.selectedSearchType === 'normal') {
        const name = 'barcelona' // always use barcelona service
        switch (name) {
          case 'arcgis': return this.arcgisService()
          case 'geoapify': return this.geoapifyService()
          case 'barcelona': return this.barcelonaService()
        }
      } else {
        // Usar búsqueda específica de capa vectorial
        return this.specificLayerSearch(this.selectedSearchType)
      }
      return null
    },
    features () {
      return this.feature ? [this.feature] : []
    },
    placeholder () {
      return this.label || this.service ? this.tr.SearchAddress : this.tr.SearchLocation
    },
    tr () {
      return {
        SearchAddress: this.$gettext('Search address'),
        SearchLocation: this.$gettext('Search location'),
      }
    }
  },
  created() {
    // Inicializar las búsquedas específicas
    this.initSpecificSearches()
  },
  mounted() {
    this.initThematicSearch();
  },
  methods: {
    selectResult(result) {
      this.text = result;
      this.results = [];
    },
    clear () {
      this.feature = null
      this.result = null
      this.suggestions = []
    },
    toggle () {
      this.expanded = !this.expanded
      if (this.expanded) {
        this.$nextTick(() => {
          this.$refs.autocomplete.focus()
        })
      } else {
        this.clear()
      }
    },
    async suggest (text) {
      return await this.service.autocomplete(text)
    },
    async onInput (item) {
      if (this.result !== item) {
        this.feature = item ? Object.freeze(await this.service.getFeature(item)) : null
        this.result = item
      }
      if (this.feature) {
        this.$map.ext.zoomToFeature(this.feature)
      }
    },
    onTextChangeDebounced: debounce(async function (text) {
      this.onTextChange(text)
    }, 400),
    async onTextChange (text) {
      if (text.length > 0) {
        if (!this.service) return
        this.loading = true
        this.error = ''
        try {
          this.suggestions = await this.suggest(text)
        } catch (err) {
          this.error = err.message || this.$gettext('Error')
        } finally {
          this.loading = false
        }
      } else {
        this.suggestions = []
      }
    },
    searchByCoords (text) {
      let coords
      if (HDMSRegex.test(text)) {
        try {
          coords = parseHDMS(text)
        } catch (err) {}
      } else if (LonLatRegex.test(text)) {
        coords = text.split(',').map(parseFloat).reverse()
      }
      if (coords) {
        const p = new Point(fromLonLat(coords, this.$map.getView().getProjection()))
        const f = new Feature({ geometry: p })
        this.feature = Object.freeze(f)
        this.$map.ext.zoomToFeature(this.feature)
      }
    },
    onEnter (e) {
      if (this.config.search_by_coords) {
        this.searchByCoords(e.target.value)
      }
    },
    initThematicSearch() {
      // Verificar si hay una búsqueda temática en la configuración
      const cercaValue = this.config.cerca;
      
      if (cercaValue && THEMATIC_SEARCHES_CONFIG[cercaValue]) {
        // Establecer el tipo de búsqueda temática por defecto
        this.selectedSearchType = cercaValue;
        
        // Añadir la búsqueda temática al selector
        this.searchTypes.push({
          value: cercaValue,
          text: THEMATIC_SEARCHES_CONFIG[cercaValue].name
        });
        
        console.log(`Búsqueda temática configurada: ${cercaValue}`);
      }
    },
    initSpecificSearches() {
      this.specificSearches = []
      this.searchTypes = [{ value: 'normal', text: this.$gettext('Búsqueda normal') }]
      
      // Buscar capas con la variable qV_search
      if (this.project && this.project.layers) {
        this.project.layers.forEach(layer => {
          if (layer.qV_search) {
            // Parsear la variable qV_search
            const searchConfig = this.parseQVSearch(layer.qV_search, layer.name)
            if (searchConfig) {
              this.specificSearches.push(searchConfig)
              this.searchTypes.push({
                value: searchConfig.id,
                text: searchConfig.fieldText || searchConfig.id
              })
            }
          }
        })
      }

      if (this.specificSearches.length > 0) {
        this.currentPlaceholder = this.tr.SearchAddress
      }
    },
    parseQVSearch(qvSearch, layerName) {
      try {
        // Patrón para extraer field, fieldText y desc
        const fieldMatch = qvSearch.match(/field="([^"]+)"/)
        const fieldTextMatch = qvSearch.match(/fieldtext="([^"]+)"/)
        const descMatch = qvSearch.match(/desc="([^"]+)"/)
        
        if (!fieldMatch) return null
        
        return {
          id: layerName, // Usar el nombre de la capa como ID
          layerName: layerName,
          field: fieldMatch[1],
          fieldText: fieldTextMatch ? fieldTextMatch[1] : layerName,
          desc: descMatch ? descMatch[1] : '',
        }
      } catch (err) {
        console.error('Error parsing qV_search variable:', err)
        return null
      }
    },
    onSearchTypeChange() {
      this.clear()
      
      // Actualizar el placeholder según el tipo de búsqueda seleccionado
      if (this.selectedSearchType === 'normal') {
        this.currentPlaceholder = this.tr.SearchAddress
      } else {
        const searchConfig = this.specificSearches.find(s => s.id === this.selectedSearchType)
        if (searchConfig && searchConfig.desc) {
          this.currentPlaceholder = searchConfig.desc
        } else {
          this.currentPlaceholder = this.tr.SearchLocation
        }
      }
    },
    specificLayerSearch(searchTypeId) {
      const searchConfig = this.specificSearches.find(s => s.id === searchTypeId)
      if (!searchConfig) return null
      
      return {
        autocomplete: async (text) => {
          try {
            if (text.length < 2) return [] // Requiere mínimo 2 caracteres
            
            // Buscar la capa en el mapa
            const map = this.$map
            let targetLayer = null
            
            map.getLayers().forEach(layer => {
              if (layer.get('name') === searchConfig.layerName) {
                targetLayer = layer
              }
            })
            
            if (!targetLayer) {
              throw new Error(`Capa "${searchConfig.layerName}" no encontrada`)
            }
            
            // Verificar si la capa está activada, si no lo está, activarla
            if (!targetLayer.getVisible()) {
              targetLayer.setVisible(true)
            }
            
            // Obtener la fuente de datos de la capa
            const source = targetLayer.getSource()
            const suggestions = []
            
            // Filtrar features según el texto de búsqueda
            const searchText = text.toLowerCase()
            
            source.forEachFeature(feature => {
              const properties = feature.getProperties()
              const fieldValue = properties[searchConfig.field]
              
              if (fieldValue && fieldValue.toString().toLowerCase().includes(searchText)) {
                suggestions.push({
                  text: fieldValue.toString(),
                  feature: feature,
                  originalFeature: feature,
                  geom: feature.getGeometry()
                })
              }
            })
            
            // Limitar a 10 resultados y ordenar alfabéticamente
            return Object.freeze(suggestions
              .sort((a, b) => a.text.localeCompare(b.text))
              .slice(0, 10))
          } catch (error) {
            console.error('Error en búsqueda específica:', error)
            throw new Error(this.$gettext('Error en la búsqueda específica'))
          }
        },
        
        getFeature: async (item) => {
          this.text = item.text
          
          // Crear una copia de la feature con su geometría original
          const featClone = new Feature({
            geometry: item.geom,
            properties: item.originalFeature ? item.originalFeature.getProperties() : {}
          })
          
          // Destacar la feature (esto dependerá de cómo manejas el resaltado en tu app)
          this.highlightFeature(item.originalFeature)
          
          return featClone
        }
      }
    },
    highlightFeature(feature) {
      // Implementar según tu sistema de resaltado
      // Ejemplo:
      if (this.$map && this.$map.ext && this.$map.ext.highlightFeature) {
        this.$map.ext.highlightFeature(feature)
      }
    },
    thematicSearchService(searchTypeId) {
      const searchConfig = THEMATIC_SEARCHES_CONFIG[searchTypeId];
      
      if (!searchConfig) return null;
      
      return {
        autocomplete: async (text) => {
          try {
            const response = await axios.get(searchConfig.url, {
              params: {
                q: text,
                max: 8,
                out_proj: "EPSG:4326",
                ...searchConfig.params
              }
            });
            
            let suggestions = [];
            if (response.data && response.data.resultats) {
              suggestions = searchConfig.resultPath 
                ? response.data.resultats[searchConfig.resultPath] 
                : response.data.resultats;
              
              suggestions.forEach(i => {
                i.text = i[searchConfig.textField || 'nomComplet'];
                const coords = searchConfig.coordsPath 
                  ? [i[searchConfig.coordsPath].x, i[searchConfig.coordsPath].y]
                  : [i.localitzacio.x, i.localitzacio.y];
                i.geom = new Point(fromLonLat(coords, this.$map.getView().getProjection()));
              });
            }
            return Object.freeze(suggestions);
          } catch (error) {
            console.error("Error en búsqueda temática:", error);
            throw new Error(this.$gettext('Error en la búsqueda temática'));
          }
        },
        
        getFeature: async (item) => {
          this.text = item.text;
          return new Feature({ geometry: item.geom });
        }
      };
    },
    barcelonaService() {
      return {
        autocomplete: async (text) => {
          const [x, y] = this.$map.getView().getCenter()
          const [lon, lat] = toLonLat([x, y], this.$map.getView().getProjection())
          const projection = this.$map.getView().getProjection()
          const response = await axios.get(`https://w33.bcn.cat/geoBCN/serveis/territori?q=${text}&max=8&out_proj=EPSG:4326`);
          let suggestions = response.data.resultats.adreces
          const carrers = response.data.resultats.vies
          let isAdreca = false
          if(text.match(/\d+$/)) isAdreca = true
          if(carrers.length > 1 && !isAdreca) {
            suggestions = carrers
          } else if(suggestions.length === 1 && carrers && carrers.length > 1) {
            suggestions = suggestions.concat(carrers)
          }
          suggestions.forEach(i => {
            i.text = i.nomComplet
            i.geom = new Point(fromLonLat([i.localitzacio.x, i.localitzacio.y], this.$map.getView().getProjection()))
          });
          return Object.freeze(suggestions)
        },
        getFeature: async (item) => {
          this.text = item.text;
          return new Feature({ geometry: item.geom })
        }
      }
    },
    arcgisService () {
      const wkid = this.project.config.projection.split(':')?.[1]
      const formatExtent = extent => {
        const [ xmin, ymin, xmax, ymax ] = extent
        return JSON.stringify({
          xmin, ymin, xmax, ymax,
          spatialReference: { wkid }
        })
      }
      const formatLocation = coords => {
        const [x, y] = coords
        return JSON.stringify({
          x: this.$map.ext.formatCoordinate(x),
          y: this.$map.ext.formatCoordinate(y),
          spatialReference: { wkid }
        })
      }
      const projectExtent = formatExtent(this.project.config.project_extent)
      return {
        autocomplete: async (text) => {
          const params = {
            text,
            location: formatLocation(this.$map.getView().getCenter()),
            searchExtent: projectExtent,
            maxSuggestions: 8,
            f: 'json',
            distance: 10000
          }
          const { data } = await this.$http.get(`/api/map/search/${this.project.config.name}/suggest`, { params })
          return data.suggestions
        },
        getFeature: async (item) => {
          const { text, magicKey } = item
          const params = {
            text,
            magicKey: magicKey,
            SingleLine: text,
            searchExtent: projectExtent,
            location: formatLocation(this.$map.getView().getCenter()),
            outSR: wkid,
            f: 'json'
          }
          const { data } = await this.$http.get(`/api/map/search/${this.project.config.name}/findAddressCandidates`, { params })
          const result = data.candidates[0]
          if (result) {
            const { x, y } = result.location
            return new Feature({ geometry: new Point([x, y]) })
          }
          return null
        }
      }
    },
    geoapifyService () {
      return {
        autocomplete: async (text) => {
          const [x, y] = this.$map.getView().getCenter()
          const [lon, lat] = toLonLat([x, y], this.$map.getView().getProjection())
          const projectExtent = this.project.config.project_extent
          const viewExtent = this.$map.getView().calculateExtent()
          const filters = [
            `rect:${transformExtent(projectExtent, this.$map.getView().getProjection(), 'EPSG:4326')}`
          ]
          const biases = [
            `proximity:${lon},${lat}`,
            `rect:${transformExtent(viewExtent, this.$map.getView().getProjection(), 'EPSG:4326')}`
          ]
          const params = {
            text,
            format: 'json',
            filter: filters.join('|'),
            bias: biases.join('|')
          }
          const { data } = await this.$http.get(`/api/map/search/${this.project.config.name}/autocomplete`, { params })
          const suggestions = data.results
          suggestions.forEach(i => {
            i.text = i.formatted
            i.geom = new Point(fromLonLat([i.lon, i.lat], this.$map.getView().getProjection()))
          })
          return Object.freeze(suggestions)
        },
        getFeature: async (item) => {
          return new Feature({ geometry: item.geom })
        }
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.search-tool {
  margin-top: 7px;
  margin-bottom: 7px;
  --gutter: 0;
  --fill-color: #3b3b3b;
  --border-color: #5a5a5a;
  border-radius: 4px;
  background-color: #333;
  .btn {
    width: 32px;
    height: 32px;
  }
  .i-field.autocomplete {
    min-width: 280px;
    ::v-deep {
      .input {
        height: 28px;
      }
    }
  }
  .i-field.select {
    line-height: 28px;
    min-width: 130px; // Ancho mínimo para mostrar bien los textos
    font-size: 14px;
    ::v-deep {
      .input {
        height: 28px;
      }
    }
  }
  .toolbar {
    gap: 6px;
    padding-right: 6px;
  }
}

.search-type-select {
  min-width: 120px;
  margin-right: 5px;
}
</style>
