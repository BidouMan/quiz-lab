<script setup lang="ts">
import { computed } from 'vue'
import KatexSpan from './KatexSpan.vue'

/** 渲染含 $...$ 内联公式的文本 */
const props = defineProps<{ text: string }>()

interface Seg {
  kind: 'text' | 'math'
  v: string
}

const segments = computed<Seg[]>(() => {
  const out: Seg[] = []
  let rest = props.text
  while (rest.length > 0) {
    const i = rest.indexOf('$')
    if (i < 0) {
      out.push({ kind: 'text', v: rest })
      break
    }
    if (i > 0) out.push({ kind: 'text', v: rest.slice(0, i) })
    const j = rest.indexOf('$', i + 1)
    if (j < 0) {
      out.push({ kind: 'text', v: rest.slice(i) })
      break
    }
    out.push({ kind: 'math', v: rest.slice(i + 1, j) })
    rest = rest.slice(j + 1)
  }
  return out
})
</script>

<template>
  <span>
    <template v-for="(s, i) in segments" :key="i">
      <KatexSpan v-if="s.kind === 'math'" :tex="s.v" />
      <template v-else>{{ s.v }}</template>
    </template>
  </span>
</template>
