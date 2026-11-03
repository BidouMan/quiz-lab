<script setup lang="ts">
import { params, regenerate } from '../store'
import type { GradeSemester } from '../types'

const grades: { value: GradeSemester; label: string }[] = [
  { value: '3A', label: '三年级上' },
  { value: '3B', label: '三年级下' },
]

function printPaper() {
  window.print()
}
</script>

<template>
  <header class="topbar">
    <div class="brand">QuizLab · 数学每日一练</div>
    <div class="actions">
      <label class="field">
        <span>年级</span>
        <select v-model="params.grade">
          <option v-for="g in grades" :key="g.value" :value="g.value">{{ g.label }}</option>
        </select>
      </label>
      <label class="field title-field">
        <span>卷名</span>
        <input v-model="params.title" type="text" maxlength="20" />
      </label>
      <button class="btn" @click="regenerate">生成</button>
      <button class="btn primary" @click="printPaper">打印 / 导出 PDF</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  flex: none;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #000;
}
.brand {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #333;
}
select,
input {
  font: inherit;
  font-size: 13px;
  color: #000;
  background: #fff;
  border: 1px solid #bbb;
  border-radius: 4px;
  padding: 4px 6px;
}
.title-field input {
  width: 150px;
}
.btn {
  font: inherit;
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 4px;
  border: 1px solid #000;
  background: #fff;
  color: #000;
  cursor: pointer;
}
.btn.primary {
  background: #000;
  color: #fff;
}
.btn:hover {
  filter: brightness(0.92);
}
</style>
