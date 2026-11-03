<script setup lang="ts">
import { computed } from 'vue'
import type { AppConfig, AppType, TemplateInfo, TypstInfo } from './types'
import { TYPE_OPTIONS } from './typstData'

const props = defineProps<{
  config: AppConfig
  template: TemplateInfo | null
  typst: TypstInfo | null
  typstError: string
  checking: boolean
}>()

const emit = defineEmits<{ checkTypst: [] }>()

const wordSupported = computed(() => props.template?.word === true)
const templateKnown = computed(() => props.template !== null)

function isDisabled(type: AppType): boolean {
  if (type !== 'word') return false
  return !templateKnown.value || !wordSupported.value
}

function typeHint(type: AppType): string {
  if (type !== 'word') return ''
  if (!templateKnown.value) return '正在读取模板…'
  if (!wordSupported.value) return '当前模板未接入'
  return ''
}

function toggleType(type: AppType, checked: boolean) {
  const list = props.config.types
  const index = list.indexOf(type)
  if (checked && index < 0) list.push(type)
  if (!checked && index >= 0) list.splice(index, 1)
}

function setGrade(grade: '3A' | '3B') {
  props.config.grade = grade
}

function clampInt(raw: string, min: number, max: number, fallback: number) {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
</script>

<template>
  <div class="panel">
    <section class="group">
      <h2>年级</h2>
      <label class="row">
        <input
          type="radio"
          name="grade"
          :checked="config.grade === '3A'"
          @change="setGrade('3A')"
        />
        <span>三年级上册</span>
      </label>
      <label class="row">
        <input
          type="radio"
          name="grade"
          :checked="config.grade === '3B'"
          @change="setGrade('3B')"
        />
        <span>三年级下册</span>
      </label>
    </section>

    <section class="group">
      <h2>题型</h2>
      <label v-for="option in TYPE_OPTIONS" :key="option.type" class="row">
        <input
          type="checkbox"
          :checked="config.types.includes(option.type)"
          :disabled="isDisabled(option.type)"
          @change="toggleType(option.type, ($event.target as HTMLInputElement).checked)"
        />
        <span :class="{ muted: isDisabled(option.type) }">{{ option.label }}</span>
        <em v-if="typeHint(option.type)" class="tag">{{ typeHint(option.type) }}</em>
      </label>
    </section>

    <section class="group">
      <h2>数量与版面</h2>
      <label class="row field">
        <span>题量</span>
        <input
          type="number"
          min="1"
          max="100"
          :value="config.count"
          @input="
            config.count = clampInt(($event.target as HTMLInputElement).value, 1, 100, config.count)
          "
        />
      </label>
      <label class="row field">
        <span>目标页数</span>
        <input
          type="number"
          min="1"
          max="10"
          :value="config.pages"
          @input="
            config.pages = clampInt(($event.target as HTMLInputElement).value, 1, 10, config.pages)
          "
        />
      </label>
      <p class="hint">实际页数由排版引擎决定，目标页数用于对照。</p>
    </section>

    <section class="group">
      <h2>排版引擎</h2>
      <label class="stack">
        <span class="label">typst 路径</span>
        <input
          type="text"
          class="text"
          :value="config.typstPath"
          placeholder="留空自动探测 /opt/homebrew/bin/typst"
          @input="config.typstPath = ($event.target as HTMLInputElement).value"
        />
      </label>
      <div class="engine-row">
        <button class="small" :disabled="checking" @click="emit('checkTypst')">
          {{ checking ? '检测中…' : '检测' }}
        </button>
        <span v-if="typst" class="engine-ok">{{ typst.version }}</span>
        <span v-else-if="typstError" class="engine-bad">未找到</span>
      </div>
      <p v-if="typstError" class="engine-error">{{ typstError }}</p>
      <p v-else-if="typst" class="engine-path">{{ typst.path }}</p>
    </section>

    <p class="footnote">参数会自动保存，下次启动仍然生效。</p>
  </div>
</template>

<style scoped>
.panel {
  padding: 14px 16px 24px;
  font-size: 14px;
  color: #222;
}
.group {
  margin-bottom: 20px;
}
h2 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #000;
  border-bottom: 1px solid #dcdcdc;
  padding-bottom: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
}
input[type='checkbox'],
input[type='radio'] {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #000;
}
input:disabled {
  cursor: not-allowed;
}
.muted {
  color: #999;
}
.tag {
  margin-left: auto;
  font-size: 11px;
  font-style: normal;
  color: #888;
  white-space: nowrap;
}
.field {
  justify-content: space-between;
  cursor: default;
}
.field input[type='number'] {
  width: 72px;
  font: inherit;
  font-size: 13px;
  border: 1px solid #bbb;
  border-radius: 4px;
  padding: 3px 6px;
  background: #fff;
}
.hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #888;
}
.stack {
  display: block;
  margin-bottom: 8px;
}
.label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #555;
}
.text {
  width: 100%;
  font: inherit;
  font-size: 12px;
  border: 1px solid #bbb;
  border-radius: 4px;
  padding: 5px 7px;
  background: #fff;
}
.engine-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.small {
  font: inherit;
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid #999;
  border-radius: 4px;
  background: #fff;
  color: #111;
  cursor: pointer;
}
.small:hover:not(:disabled) {
  background: #f0f0f0;
}
.small:disabled {
  color: #999;
  border-color: #ccc;
  cursor: default;
}
.engine-ok {
  font-size: 11px;
  color: #333;
}
.engine-bad {
  font-size: 11px;
  color: #777;
}
.engine-error {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  background: #f4f4f4;
  border-left: 2px solid #666;
  padding: 6px 8px;
  max-height: 110px;
  overflow: auto;
}
.engine-path {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: #999;
  word-break: break-all;
}
.footnote {
  margin: 8px 0 0;
  font-size: 11px;
  color: #aaa;
}
</style>
