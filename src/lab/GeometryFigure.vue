<script setup lang="ts">
/** 内联 SVG 几何图形：纯矢量、1px 描边，打印清晰 */
defineProps<{ shape: 'rect' | 'square' }>()
</script>

<template>
  <!-- 长方形 8cm × 5cm：标注长与宽（左侧留白防标注裁切） -->
  <svg
    v-if="shape === 'rect'"
    class="fig"
    width="165"
    height="104"
    viewBox="0 0 165 104"
    role="img"
    aria-label="长方形，长8厘米，宽5厘米"
  >
    <text x="98" y="14" text-anchor="middle">8 cm</text>
    <rect x="38" y="22" width="120" height="66" fill="none" stroke="#000" stroke-width="1" />
    <text x="34" y="59" text-anchor="end">5 cm</text>
  </svg>

  <!-- 正方形 边长 6cm -->
  <svg
    v-else
    class="fig"
    width="140"
    height="104"
    viewBox="0 0 140 104"
    role="img"
    aria-label="正方形，边长6厘米"
  >
    <text x="72" y="14" text-anchor="middle">6 cm</text>
    <rect x="36" y="22" width="72" height="72" fill="none" stroke="#000" stroke-width="1" />
    <text x="32" y="62" text-anchor="end">6 cm</text>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  flex: none;
}
.fig text {
  font-size: 12px;
  font-weight: 400;
  fill: #333;
}
</style>
