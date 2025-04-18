<template>
  <div class="map-container">
    <div ref="mapEl" class="map"/>
    <app-menu class="app-menu" align="rr;tb,bt">
      <template v-slot:activator="{ toggle }">
        <v-btn
          aria-label="Menu"
          class="icon"
          color="dark"
          @click="toggle"
        >
          <v-icon name="menu-dots"/>
        </v-btn>
      </template>
    </app-menu>
    <div class="auth-status">
      <div v-if="!user.is_guest" class="signed f-row-ac">
        <v-tooltip>
          <div class="f-col text-center px-2">
            <span v-text="user.username"/>
            <template v-if="user.first_name || user.last_name">
              <hr/>
              <span>{{ user.first_name }} {{ user.last_name}}</span>
            </template>
          </div>
        </v-tooltip>
        <v-icon name="account" size="28" color="dark" class="shadow-2"/>
      </div>
      <!-- <div v-else class="guest f-row-ac">
        <v-icon name="login" size="25"/>
      </div> -->
    </div>

    <!-- <collapse-transition class="status-bar"> -->
      <bottom-toolbar v-if="statusBarVisible" class="status-bar"/>
    <!-- </collapse-transition> -->

    <!-- <scale-line/> -->
    <div class="sticky-bottom">
      <scale-line/>
      <map-attributions class="map-attributions"/>
    </div>
    <portal-target name="map-overlay" class="map-overlay" multiple/>
    <div class="top-toolbar f-row">
      <tools-menu :tools="toolsMenuItems" color="dark"/>
      <search-tool/>
      <portal-target
        name="map-toolbar"
        class="map-toolbar"
        transition="slide-top-transition"
      />
    </div>
    <transition name="fade">
      <div v-if="mapLoading" class="status f-row-ac m-2">
        <v-spinner width="2" size="18"/>
        <translate class="mx-2">Loading</translate>
      </div>
    </transition>

    <v-btn
      aria-label="Toggle panel"
      color="#444"
      class="panel-toggle icon"
      :class="{expanded: panelVisible}"
      @click="panelVisible = !panelVisible"
    >
      <v-icon name="arrow-right" size="16"/>
    </v-btn>

    <div class="right-container f-col">
      <portal-target
        name="right-panel"
        class="right-panel"
        transition="slide-top-transition"
      />
      <div class="f-grow"/>
      <!-- <map-control/> -->
    </div>
    <map-control/>

    <div ref="mapViewport" class="visible-container"/>

    <div class="bottom-container">
      <portal-target transition="collapse-transition" name="bottom-panel"/>
    </div>
    <!-- <portal-target transition="collapse-transition" name="bottom-panel" class="bottom-container"/> -->

    <transition name="collapse-width">
      <div
        v-show="panelVisible"
        class="main-panel"
      >
        <div class="f-col">
          <portal-target name="main-panel-top"/>
          <content-panel/>
        </div>
      </div>
    </transition>
    <map-tools ref="tools" show-header hidden-identification/>
  </div>
</template>

<script>
import { mapState } from 'vuex'

import Map from '@/mixins/Map'
import ContentPanel from '@/components/content-panel/ContentPanel.vue'
import BottomToolbar from '@/components/BottomToolbar.vue'
import MapAttributions from '@/components/MapAttributions.vue'
import ToolsMenu from '@/components/ToolsMenu.vue'
import MapControl from '@/components/MapControl.vue'
import ScaleLine from '@/components/ol/ScaleLine.vue'
import MapTools from '@/components/MapTools.vue'
import AppMenu from '@/components/AppMenu.vue'
import SearchTool from '@/components/SearchTool.vue'

export default {
  name: 'Map',
  mixins: [Map],
  components: {
    ContentPanel, BottomToolbar, ScaleLine, MapAttributions, ToolsMenu, MapControl, MapTools, AppMenu, SearchTool
  },
  refs: ['tools'],
  data () {
    return {
      panelVisible: true,
      statusBarVisible: true
    }
  },
  computed: {
    ...mapState(['user']),
    toolsMenuItems () {
      const tools = (this.$refs.tools && this.$refs.tools.items) || []
      return tools.filter(t => !t.disabled)
    }
  },
  created () {
    this.$root.$panel = {
      setStatusBarVisible: (visible) => {
        this.statusBarVisible = visible
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.collapse-width-enter-active, .collapse-width-leave-active {
  transition: all .5s;
}
.collapse-width-enter, .collapse-width-leave-to {
  width: 0!important;
}
.visible-container {
  flex-grow: 1;
  pointer-events: none;
  position: relative;
  > * {
    pointer-events: auto;
  }
}
.map-overlay {
  pointer-events: none;
}

.main-panel {
  overflow: hidden;
  > div {
    align-self: flex-end;
    width: 288px;
    flex: 1 1;
    overflow: hidden;
    // > .collapsible {
    //   flex-shrink: 0;
    // }
  }
  .content-panel {
    flex: 1 1;
    overflow: hidden;
  }
}

.map-container {
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: 1fr minmax(0, max-content) minmax(0, min-content) minmax(0, min-content);
  > * {
    position: relative;
  }

  .map {
    grid-column: 1 / 4;
    grid-row: 1 / 5;
    z-index: 0;
    min-width: 0;
    min-height: 0;
  }
  .right-container {
    grid-column: 3 / 4;
    grid-row: 1 / 2;
    justify-content: flex-end;
    align-items: flex-end;
    // justify-items: center;
    min-height: 0;
    max-height: 100%;
    margin: 6px 44px 0 0;
    pointer-events: none;
    > * {
      pointer-events: auto;
    }
    .map-control {
      flex: 0 0;
    }
  }
  .sticky-bottom {
    grid-column: 2 / 4;
    grid-row: 3 / 4;
    position: relative;
    overflow: visible;
    > * {
      position: absolute;
      bottom: 2px;
    }
    .scale-line {
      left: 0;
    }
    .map-attributions {
      right: 2px;
      left: 10em;
    }
  }
  .map-attributions {
    z-index: 1;
  }
  .main-panel {
    grid-column: 1 / 2;
    grid-row: 1 / 5;
    z-index: 2;
  }
  .top-toolbar {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
    align-self: start;
    justify-self: start;
    align-items: start;
    z-index: 2;
    .search-tool {
      min-height: 35px;
    }
  }
  .panel-toggle {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
    align-self: center;
    z-index: 1;
  }
  .map-control {
    grid-column: 3 / 4;
    grid-row: 1 / 2;
    margin: 0.25em;
    z-index: 2;

    align-self: end;
    justify-self: end;
  }
  .app-menu {
    grid-column: 3 / 4;
    grid-row: 1 / 2;
    align-self: start;
    justify-self: end;
  }
  .right-panel {
    // grid-column: 3 / 4;
    // grid-row: 1 / 2;
    z-index: 2;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    justify-content: flex-end;
  }
  .visible-container {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
    min-width: 0;
    min-height: 0;
    max-height: 100%;
  }
  .map-overlay {
    grid-column: 2 / 4;
    grid-row: 1 / 2;
    min-width: 0;
    min-height: 0;
    max-height: 100%;
  }
  .status-bar {
    grid-column: 1 / 4;
    grid-row: 4 / 5;
    z-index: 1;
    align-self: end;
  }
  .bottom-container {
    grid-column: 2 / 4;
    grid-row: 2 / 5;
    z-index: 2;
    min-width: 0;
    max-width: 100%;
  }
  .status {
    grid-column: 1 / 4;
    grid-row: 1 / 2;
    align-self: start;
    justify-self: center;
    z-index: 1;
    min-width: 0;
    max-width: 100%;
    background-color: rgba(var(--color-dark-rgb), 0.85);
    color: #fff;
    border-radius: 4px;
    padding: 2px 4px;
    pointer-events: none;
  }
  .auth-status {
    grid-column: 3 / 4;
    grid-row: 1 / 2;
    align-self: start;
    justify-self: end;
    z-index: 1;
    top: 8px;
    right: 48px;
    .guest {
      margin: 2px;
    }
    .signed {
      .icon {
        background-color: #fff;
        border-radius: 50%;
      }
    }
  }
}

.map {
  width: 100%;
  height: 100%;
  background-color: #fff;
}

.main-panel {
  position: relative;
  width: 288px;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-right: 1px solid #aaa;
  box-shadow:
    0 6px 6px -3px rgba(0,0,0,.2),
    0 10px 14px 1px rgba(0,0,0,.14),
    0 4px 18px 3px rgba(0,0,0,.12);
}

.btn.panel-toggle {
  margin: 0;
  width: 20px;
  height: 36px;
  
  min-width: 0;
  padding: 0;
  border-radius: 0;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  &.expanded .icon {
    transform: rotateY(180deg);
  }
}

.bottom-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  pointer-events: none;
  .collapse-enter-active, .collapse-leave-active {
    overflow: visible!important;
  }
  /*.collapse-enter, .collapse-leave-to {
    opacity: 0!important;
  }*/
}

.app-menu {
  .btn {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    opacity: 0.95;
  }
}
.map-toolbar {
  margin: 8px 6px 6px 6px;
}
</style>
