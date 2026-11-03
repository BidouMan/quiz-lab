<script setup lang="ts">
import katex from 'katex'
import { computed } from 'vue'

const props = defineProps<{ tex: string }>()

const html = computed(() =>
  katex.renderToString(props.tex, {
    throwOnError: false,
    output: 'html',
  }),
)
</script>

<template>
  <span class="katex-span" v-html="html"></span>
</template>
