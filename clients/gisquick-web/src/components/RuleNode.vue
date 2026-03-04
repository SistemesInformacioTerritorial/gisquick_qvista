<template>
  <div class="rule-node" :style="{ marginLeft: depth * 16 + 'px' }">
    <div class="f-row-ac">
      <input
        type="checkbox"
        :checked="node.visible"
        @change="$emit('toggle', node)"
      />

      <span class="f-grow"> {{ node.title }}</span>

      <img
        v-if="node.icon"
        :src="'data:image/png;base64,' + node.icon"
        alt="icon"
      />

      <button
        v-if="node.children && node.children.length"
        @click="expanded = !expanded"
        class="arrow-btn"
      >
        <v-icon v-if="!expanded"
          class="toggle mx-2"
          name="arrow-down"
          size="12"
        />

        <v-icon v-if="expanded"
          class="toggle mx-2 toggle-up"
          name="arrow-down"
          size="12"
        />
      </button>
    </div>

    <div v-if="expanded">
      <RuleNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script>
export default {
  name: 'RuleNode',
  props: {
    node: Object,
    depth: { type: Number, default: 0 }
  },
  data () {
    return {
      expanded: true
    }
  }
}
</script>

<style lang="scss" scoped>
.toggle-up {
  transform: rotate(180deg);
}

.arrow-btn {
  background-color: transparent;
  border: 0px;
  cursor: pointer;
}
</style>
