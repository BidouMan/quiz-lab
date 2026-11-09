<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'

/** 仅在开发构建加载：按钮与面板都在这里，正式包里不会出现 */
const DevPanel = defineAsyncComponent(() => import('./ReadingStudio.vue'))
const open = ref(false)
</script>

<template>
  <button class="ghost" @click="open = true">开发者工具</button>
  <Teleport to="body">
    <DevPanel v-if="open" @close="open = false" />
  </Teleport>
</template>

<style scoped>
.ghost {
  font: inherit;
  font-size: 13px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #e3e3e3;
  border-radius: 6px;
  background: #fff;
  color: #111;
  cursor: pointer;
  white-space: nowrap;
  flex: none;
}
.ghost:hover {
  background: #f6f6f6;
}
</style>
