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
        v-if="searchTypes.length > 1"
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
        @input="onInput"
        @text:update="onTextChangeDebounced"
        @keydown.enter="onEnter"
        @clear="clear"
      >
        <template v-slot:item="{ html, item }">
          <div class="item f-row f-grow">
            <div class="f-grow">
              <span v-if="item.info" class="info-message" :class="{ error: item.error }">
                <v-icon v-if="item.error" name="warning" color="red" small/>
                <v-icon v-else name="info" color="blue" small/>
                {{ item.text }}
              </span>
              <span v-else class="address" v-html="html.text"/>
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
import { mapState } from 'vuex'
import debounce from 'lodash/debounce'
import VAutocomplete from '@/ui/Autocomplete.vue'
import FeaturesViewer from '@/components/ol/FeaturesViewer.vue'
import { SearchService } from '@/services/SearchService'
import { SpecificSearchService } from '@/services/SpecificSearchService'

export default {
  name: 'SearchTool',
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
      specificSearches: [],
      searchTypes: [{ value: 'normal', text: 'Cerca normal' }],
      currentPlaceholder: '',
      
      // Services
      searchService: null,
      specificSearchService: null
    }
  },
  
  computed: {
    ...mapState(['project']),
    
    config() {
      return this.project?.config?.search ?? {}
    },
    
    enabled() {
      return true
    },
    
    service() {
      if (this.selectedSearchType === 'normal') {
        return this.searchService.barcelonaService()
      } else {
        const searchConfig = this.specificSearches.find(s => s.id === this.selectedSearchType)
        // CANVI: usar el nou mètode simple
        return searchConfig ? this.specificSearchService.createSimpleLayerSearchService(searchConfig) : null
      }
    },
    
    features() {
      return this.feature ? [this.feature] : []
    },
    
    projectLayers() {
      if (this.project?.overlays?.list) {
        let layers = this.project.overlays.list
        if (typeof layers === 'object' && !Array.isArray(layers)) {
          layers = Object.values(layers)
        }
        return layers
      }
      return []
    }
  },

  watch: {
    project: {
      handler(newProject, oldProject) {
        console.log('🔄 [SearchTool] Project changed', { newProject, oldProject })
        if (newProject && newProject !== oldProject) {
          // Esperar a que el proyecto esté completamente cargado
          this.$nextTick(() => {
            setTimeout(() => {
              this.initSpecificSearches()
            }, 100) // Pequeño delay para asegurar que todo esté listo
          })
        }
      },
      immediate: true,
      deep: false // Evitar watchers innecesarios en propiedades anidadas
    },
    
    // Añadir watcher específico para las capas
    projectLayers: {
      handler(newLayers) {
        console.log('🔄 [SearchTool] Project layers changed:', newLayers)
        if (newLayers && newLayers.length > 0) {
          this.$nextTick(() => {
            this.initSpecificSearches()
          })
        }
      },
      immediate: false
    }
  },
  
  mounted() {
    // Inicializar services con las dependencias necesarias
    this.searchService = new SearchService(this.$map)
    
    this.initSpecificSearches()
  },
  
  methods: {
    // === MÉTODOS BÁSICOS DE UI ===
    clear() {
      this.feature = null
      this.result = null
      this.suggestions = []
    },
    
    toggle() {
      this.expanded = !this.expanded
      if (this.expanded) {
        this.$nextTick(() => {
          this.$refs.autocomplete.focus()
        })
      } else {
        this.clear()
      }
    },

    // === MÉTODOS DE BÚSQUEDA ===
    async suggest(text) {
      if (text.length < 2) return [];
      this.loading = true;
      try {
      } catch (error) {
        this.error = 'Error en la búsqueda';
      } finally {
        this.loading = false;
      }
    },
    
    async onInput(item) {
      if (this.result !== item) {
        this.feature = item ? Object.freeze(await this.service.getFeature(item)) : null
        this.result = item
      }
      if (this.feature) {
        this.$map.ext.zoomToFeature(this.feature)
      }
    },
    
    onTextChangeDebounced: debounce(async function (text) {
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
    }, 400),
    
    onEnter(e) {
      if (this.config.search_by_coords) {
        const coordsService = this.searchService.coordsService()
        const feature = coordsService.searchByCoords(e.target.value)
        if (feature) {
          this.feature = Object.freeze(feature)
          this.$map.ext.zoomToFeature(this.feature)
        }
      }
    },

    // === MÉTODOS DE CONFIGURACIÓN ===
    initSpecificSearches() {
      console.log('🔍 [DEBUG] Project layers received:', this.projectLayers)
      
      this.projectLayers.forEach((layer, index) => {
        console.log(`🔍 [DEBUG] Layer ${index}:`, {
          name: layer.name,
          title: layer.title,
          qV_search: layer.qV_search,
          hasQVSearch: !!layer.qV_search
        })
      })
      
      const result = this.specificSearchService.initSpecificSearches(this.projectLayers)
      this.specificSearches = result.specificSearches
      this.searchTypes = result.searchTypes
      
      console.log('🔍 [DEBUG] Final search types:', this.searchTypes)
      console.log('🔍 [DEBUG] Specific searches:', this.specificSearches)
      
      this.updatePlaceholder()
    },
    
    onSearchTypeChange() {
      this.clear()
      this.updatePlaceholder()
    },
    
    // NOMÉS afegir aquest mètode:
    updatePlaceholder() {
      if (this.selectedSearchType === 'normal') {
        this.currentPlaceholder = 'Cercar adreça'
      } else {
        const searchConfig = this.specificSearches.find(s => s.id === this.selectedSearchType)
        this.currentPlaceholder = searchConfig?.desc || 'Cercar ubicació'
      }
    }
  }
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
    min-width: 130px;
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

.info-message {
  display: flex;
  align-items: center;
  gap: 4px;
  font-style: italic;
  
  &.error {
    color: #ff6b6b;
  }
  
  &:not(.error) {
    color: #4dabf7;
  }
}
</style>
