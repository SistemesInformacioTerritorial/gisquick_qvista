<template>
  <div
    class="attribute-table light f-col"
    :class="{resizing}"
    :style="heightStyle"
  >
    <!-- Header -->
    <tabs-header :minimized.sync="minimized" @close="$emit('close')">
      <a slot="tabs" class="item xactive">
        {{ layer.title }}
      </a>
    </tabs-header>
    <div class="resize-area f-row-ac" @mousedown="resizeHandler"/>
    <!-- Table -->
    <attributes-table
      ref="table"
      class="f-grow"
      fetch-relations
      :project="project"
      :layer="layer"
      :filters="layerFilters"
      :features="features"
      :limit="limit"
      :visible-area-filter="visibleAreaFilter"
      :selected-id="selected && selected.id"
      :pagination.sync="pagination"
      :sort-by.sync="sortBy"
      @update:features="updateFeatures"
      @update:limit="updateLimit"
      @update:visibleAreaFilter="updateVisibleAreaFilter"
      @update:filters="updateFilters"
      @update:selectedId="updateSelection"
    >
      <template v-slot:header(actions)>
        <!-- <v-menu>
          <template v-slot:activator="{ toggle }">
            <v-btn class="icon flat m-0" @click="toggle">
              <v-icon name="menu"/>
            </v-btn>
          </template>
        </v-menu> -->
      </template>
      <template v-slot:actions="{ row, item }">
        <v-btn class="icon flat my-0 mr-0" @click="[mode = 'view', showInfoPanel = true]">
          <v-icon name="circle-i-outline"/>
        </v-btn>
      </template>

      <template v-slot:actions_nexus="{ row, item }">
        <div class="f-row-ac">
          <v-btn
            v-if="item?.actions?.length <= 3"
            v-for="action in item.actions"
            :key="action.id"
            class="icon flat my-0 mr-0"
            @click="runActionMethod(action)"
          >
            <custom-icon
              :name="getActionIcon(action.action_type)"
              class="svg-icon"
            />
            <v-tooltip slot="tooltip">{{ action.short_title }}</v-tooltip>
          </v-btn>

          <div class="tools-menu f-col f-justify-start"
            v-if="item?.actions?.length > 3"
          >
            <v-btn class="icon flat" @click="toggleOpen(item._id, $event)">
              <transition-group name="menu">
                <v-icon v-if="isOpen(item._id)" :key="item._id + '_closeTooltip'" name="x" />
                <custom-icon
                  v-if="!isOpen(item._id)"
                  name="add"
                  class="svg-icon"
                  :key="item._id + '_openTooltip'"
                />
              </transition-group>
            </v-btn>

            <portal to="body-portal">
              <transition name="menu-items">
                <div class="floating-list" v-if="isOpen(item._id)"
                  :style="menuPosition[item._id]"
                >
                  <v-btn
                    v-for="collapsedAction in item.actions"
                    :key="collapsedAction.id"
                    class="icon flat my-0 mr-0"
                    @click="runActionMethod(collapsedAction)"
                  >
                    <custom-icon
                      :name="getActionIcon(collapsedAction.action_type)"
                      class="svg-icon"
                    />
                    <v-tooltip slot="tooltip">{{ collapsedAction.short_title }}</v-tooltip>
                  </v-btn>
                </div>
              </transition>
            </portal>
          </div>
        </div>
      </template>

      <template v-slot:toolbar>
        <div class="v-separator"/>
        <v-btn
          v-if="permissions.insert"
          class="icon"
          @click="[mode = 'add', showInfoPanel = true]"
        >
          <v-tooltip slot="tooltip">
            <translate>Add new feature</translate>
          </v-tooltip>
          <v-icon name="attribute-table-add"/>
        </v-btn>
        <v-btn
          v-if="attributesToExport.length"
          color="primary"
          :disabled="!attributesToExport.length"
          @click="exportFeatures"
        >
          <v-icon name="download" size="14" class="mr-2"/>
          <translate>Export</translate>
        </v-btn>
      </template>
    </attributes-table>

    <portal to="right-panel">
      <info-panel
        v-if="showInfoPanel"
        class="mx-1 mb-2"
        :features="features"
        :layer="layer"
        :mode.sync="mode"
        :selected.sync="selected"
        @close="showInfoPanel = false"
        @insert="onFeatureInsert"
        @edit="onFeatureEdit"
        @delete="onFeatureDelete"
      />
    </portal>
  </div>
</template>

<script>
import clamp from 'lodash/clamp'
import { mapState, mapGetters, mapMutations } from 'vuex'
// import TabsHeader from '@/components/TabsHeader1.vue'
import TabsHeader from '@/components/TabsHeader.vue'
import AttributesTable from './TableView.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import { runAction } from '@/ui/utils/extraActions'

import { eventCoord, DragHandler } from '@/events'
import ToolMixin from './tool.js'
import CustomIcon from '@/components/CustomIcon.vue'
import { getIconName } from '@/icons-manager'

export default {
  name: 'attribute-table-tool',
  mixins: [ToolMixin],
  components: { TabsHeader, InfoPanel, AttributesTable, CustomIcon },
  data () {
    return {
      height: 242,
      minimized: false,
      openRows: {},
      menuPosition: {},
      resizing: false
    }
  },
  computed: {
    ...mapState(['project']),
    ...mapState('attributeTable', ['page', 'limit', 'visibleAreaFilter', 'layer', 'features']),
    ...mapGetters('attributeTable', ['layerFilters']),
    heightStyle () {
      const height = (this.minimized ? 37 : this.height) + 'px'
      return {
        height,
        // minHeight: height,
        // maxHeight: height
      }
    }
  },
  methods: {
    getActionIcon (type) {
      return getIconName(type)
    },
    updateSelection (id) {
      this.selected = { layer: this.layer.name, id }
    },
    fetchFeatures (page = 1, lastQuery = false) {
      this.$refs.table.fetchFeatures(page, lastQuery)
    },
    runActionMethod(action) {
      runAction(action)
    },
    toggleOpen(id, event) {
      if(this.openRows) {
        this.openRows = {}
        document.removeEventListener('click', this.handleClickOutside);
      }
      this.$set(this.openRows, id, !this.openRows[id]);
      if (this.openRows[id]) {
        const rect = event?.currentTarget?.getBoundingClientRect?.() || {}
        this.$set(this.menuPosition, id, {
          position: 'absolute',
          top: rect.bottom + 'px',
          left: rect.left + 'px',
          zIndex: 9
        })

        this.$nextTick(() => {
          document.addEventListener('click', this.handleClickOutside);
        });
      } else {
        document.removeEventListener('click', this.handleClickOutside);
      }
    },
    handleClickOutside(event) {
      const clickedInsideMenu = event.target.closest('.floating-list');
      const clickedButton = event.target.closest('.tools-menu');

      if (!clickedInsideMenu && !clickedButton) {
        this.openRows = {};
        document.removeEventListener('click', this.handleClickOutside);
      }
    },
    isOpen(id) {
      return !!this.openRows[id];
    },
    resizeHandler (e) {
      if (this.minimized) {
        return
      }
      const originHeight = this.height
      const originY = eventCoord(e)[1]
      const maxHeight = window.innerHeight - 120
      DragHandler(e, {
        onStart: () => {
          this.resizing = true
        },
        onMove: e => {
          const y = eventCoord(e)[1]
          const offset = y - originY
          this.height = clamp(originHeight - offset, 0, maxHeight)
        },
        onEnd: () => {
          this.resizing = false
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.attribute-table {
  // max-height: 242px;
  overflow: hidden;
  &:not(.resizing) {
    transition: height 0.4s cubic-bezier(.25,.8,.5,1);
  }
}
.info-panel {
  flex: 0 1 auto;
}
.tabs-header {
  position: absolute;
  transform: translate(0, -100%);
}
.resize-area {
  pointer-events: auto;
  position: absolute;
  width: 100%;
  min-height: 10px;
  margin-top: -5px;
  cursor: row-resize;
  z-index: 10;
  user-select: none;
  // background-color: rgba(200,0,0,0.3);
  &::after {
    content: "";
    flex: 1;
    height: 2px;
    background-color: var(--color-primary);
    transition: opacity 0.3s cubic-bezier(.25,.8,.5,1);
    transition-delay: 0.1s;
    opacity: 0;
  }
  &:hover {
    &::after {
      opacity: 1;
    }
  }
}
.floating-list {
  position: absolute;
  background: white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  border-radius: 6px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  z-index: 9;
}
.tools-menu {
  position: relative;
  .btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    margin: 2px;
  }
}

.svg-icon {
  display: inline-block;
  width: 20px;
  height: 20px;
  vertical-align: middle;
  color: currentColor; /* hereda el color del botón */
}

.svg-icon svg {
  width: 100% !important;
  height: 100% !important;
  fill: currentColor;
}
</style>
