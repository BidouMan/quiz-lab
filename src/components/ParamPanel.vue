<script setup lang="ts">
import { currentUnits, params, toggleType, toggleUnit } from '../store'
import { TYPE_LABELS, type QuestionType } from '../types'

const types = Object.entries(TYPE_LABELS) as [QuestionType, string][]

function onCountInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) params.count = Math.min(100, Math.max(1, Math.round(v)))
}
function onPagesInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) params.pages = Math.min(10, Math.max(1, Math.round(v)))
}
</script>

<template>
  <div class="panel">
    <section class="group">
      <h2>单元</h2>
      <label v-for="u in currentUnits" :key="u.id" class="row">
        <input
          type="checkbox"
          :checked="params.unitIds.includes(u.id)"
          @change="toggleUnit(u.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ u.name }}</span>
      </label>
    </section>

    <section class="group">
      <h2>题型</h2>
      <label v-for="[t, label] in types" :key="t" class="row">
        <input
          type="checkbox"
          :checked="params.types.includes(t)"
          @change="toggleType(t, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ label }}</span>
      </label>
    </section>

    <section class="group">
      <h2>数量与版面</h2>
      <label class="row field-row">
        <span>题目数量</span>
        <input
          type="number"
          min="1"
          max="100"
          :value="params.count"
          @input="onCountInput"
        />
      </label>
      <label class="row field-row">
        <span>卷面页数</span>
        <input
          type="number"
          min="1"
          max="10"
          :value="params.pages"
          @input="onPagesInput"
        />
      </label>
      <label class="row">
        <input type="checkbox" v-model="params.withAnswers" />
        <span>附答案页</span>
      </label>
    </section>

    <p class="hint">P0 为静态样例题，仅用于校验版式；三下目录为推定结构，待新版教材目录发布后校准。</p>
  </div>
</template>

<style scoped>
.panel {
  padding: 14px 16px 20px;
  font-size: 14px;
}
.group {
  margin-bottom: 18px;
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
  color: #222;
}
input[type='checkbox'] {
  width: 15px;
  height: 15px;
  accent-color: #000;
}
.field-row {
  justify-content: space-between;
  cursor: default;
}
.field-row input[type='number'] {
  width: 72px;
  font: inherit;
  font-size: 13px;
  border: 1px solid #bbb;
  border-radius: 4px;
  padding: 3px 6px;
}
.hint {
  margin-top: 20px;
  font-size: 12px;
  line-height: 1.7;
  color: #888;
}
</style>
