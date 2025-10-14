<template>
  <span class="custom-icon" v-html="iconSvg" />
</template>

<script>
import { icons } from '@/icons-manager'

export default {
  props: { name: String },
  computed: {
    iconSvg () {
      return icons[this.name] || `
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none"/>
          <text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor">?</text>
        </svg>`
    }
  }
}
</script>
