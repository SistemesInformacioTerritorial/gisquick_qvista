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
// Importaciones existentes
import { mapState } from 'vuex'
import debounce from 'lodash/debounce'
import Point from 'ol/geom/Point'
import Feature from 'ol/Feature'
import VAutocomplete from '@/ui/Autocomplete.vue'
import FeaturesViewer from '@/components/ol/FeaturesViewer.vue'
// Importar el nuevo servicio
import { SearchServices } from '@/services/SearchServices'

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
        { value: 'normal', text: this.$gettext('Cerca normal') }
      ],
      currentPlaceholder: '',
      searchServices: null, // Nueva propiedad para almacenar el servicio
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
          case 'arcgis': return this.searchServices.arcgisService(this.project);
          case 'geoapify': return this.searchServices.geoapifyService(this.project);
          case 'barcelona': return this.searchServices.barcelonaService();
        }
      } else {
        // Usar búsqueda específica de capa vectorial
        return this.specificLayerSearch(this.selectedSearchType);
      }
      return null;
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
    },
    // CRÍTICO: Acceder correctamente a las capas desde la estructura real del store
    projectLayers() {
      console.log('🔎 [projectLayers] Checking project structure:', this.project);
      
      // Verificar diferentes estructuras posibles
      let layers = null;
      
      if (this.project) {
        // Opción 1: project.overlays.list (estructura actual de Gisquick)
        if (this.project.overlays && this.project.overlays.list) {
          layers = this.project.overlays.list;
          console.log('🔎 Found layers at project.overlays.list:', layers);
          console.log('🔎 overlays.list type:', typeof layers);
          console.log('🔎 overlays.list is array:', Array.isArray(layers));
          
          // Si overlays.list es un objeto, convertir a array
          if (typeof layers === 'object' && !Array.isArray(layers)) {
            layers = Object.values(layers);
            console.log('🔎 Converted object to array:', layers);
          }
        }
        // Opción 2: project.overlays.tree (estructura de árbol)
        else if (this.project.overlays && this.project.overlays.tree) {
          layers = this.project.overlays.tree;
          console.log('🔎 Found layers at project.overlays.tree:', layers);
        }
        // Opción 3: project.config.layers
        else if (this.project.config && this.project.config.layers) {
          layers = this.project.config.layers;
          console.log('🔎 Found layers at project.config.layers:', layers);
        }
        // Opción 4: project.layers (esperado original)
        else if (this.project.layers) {
          layers = this.project.layers;
          console.log('🔎 Found layers at project.layers:', layers);
        }
        // Opción 5: project.overlays directamente (si es array)
        else if (this.project.overlays && Array.isArray(this.project.overlays)) {
          layers = this.project.overlays;
          console.log('🔎 Found layers at project.overlays:', layers);
        }
      }

      console.log('🔎 Final layers found:', layers);
      console.log('🔎 Final layers type:', typeof layers);
      console.log('🔎 Final layers is array:', Array.isArray(layers));
      
      return layers || [];
    }
  },
  watch: {
    // CRÍTICO: Observar cambios en el proyecto y en las capas computadas
    project: {
      handler(newProject, oldProject) {
        console.log('🔄 [SearchTool] Project changed');
        console.log('🔄 New project:', newProject);
        console.log('🔄 Old project:', oldProject);
        
        if (newProject && newProject !== oldProject) {
          this.$nextTick(() => {
            this.initSpecificSearches();
          });
        }
      },
      deep: true,
      immediate: true
    },
    
    // Observar cambios en las capas computadas
    projectLayers: {
      handler(newLayers) {
        console.log('🔄 [SearchTool] Project layers changed:', newLayers);
        if (newLayers && newLayers.length > 0) {
          this.$nextTick(() => {
            this.initSpecificSearches();
          });
        }
      },
      deep: true,
      immediate: true
    }
  },
  created() {
    console.log('🚀 [SearchTool] Component created');
    // Inicializar el servicio de búsqueda
    this.searchServices = new SearchServices(this.$http, this.$map);
    // Inicializar las búsquedas específicas
    this.initSpecificSearches();
  },
  mounted() {
    console.log('🚀 [SearchTool] Component mounted');
    console.log('🚀 Project at mount:', this.project);
    
    this.initThematicSearch();
    
    // Forzar inicialización después del montaje
    this.$nextTick(() => {
      console.log('🚀 [SearchTool] NextTick - forcing init');
      this.initSpecificSearches();
    });
  },
  methods: {
    // Mover la función normalizeLayerName aquí
    normalizeLayerName(name) {
      if (!name) return '';
      return name.toString().toLowerCase()
        .replace(/[\s-_]+/g, '') // Eliminar espacios, guiones y guiones bajos
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Eliminar acentos
    },
    
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
      console.log('🔍 [initSpecificSearches] Starting initialization');
      
      this.specificSearches = []
      this.searchTypes = [{ value: 'normal', text: this.$gettext('Cerca normal') }]
      
      // Usar las capas del computed property
      const layers = this.projectLayers;
      
      if (layers && Array.isArray(layers) && layers.length > 0) {
        console.log('🔍 Processing', layers.length, 'layers');
        
        layers.forEach((layer, index) => {
          console.log(`🔍 [Layer ${index}] Processing:`, layer.name);
          
          // NUEVO: Buscar todas las propiedades que empiezan con qV_search
          const searchProperties = Object.keys(layer || {}).filter(key => 
            key.startsWith('qV_search')
          );
          
          console.log(`🔍 [Layer ${index}] Found ${searchProperties.length} search properties:`, searchProperties);
          
          // Procesar cada propiedad de búsqueda
          searchProperties.forEach(propName => {
            const qvSearchValue = layer[propName];
            console.log(`🔍 [Layer ${index}] Processing ${propName}:`, qvSearchValue);
            
            // Generar un ID único para esta búsqueda
            // Usar _1, _2, etc. al final si hay múltiples búsquedas
            const searchSuffix = propName === 'qV_search' ? '' : 
                                '_' + propName.replace('qV_search_', '');
            
            const searchId = layer.name + searchSuffix;
            
            const searchConfig = this.parseQVSearch(qvSearchValue, layer.name, searchId);
            if
