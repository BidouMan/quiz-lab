<script setup lang="ts">
import { CHINESE_CONTENT, PLACEHOLDER_TEXT } from './subjects'

const emit = defineEmits<{ generate: [] }>()
</script>

<template>
  <div class="params">
    <div class="params-scroll">
      <section>
        <h2>单元选择</h2>
        <div class="ph-unit" v-for="unit in CHINESE_CONTENT.units" :key="unit.unitId">
          {{ unit.unitName }}
        </div>
      </section>

      <section>
        <h2>题型设置</h2>
        <div class="ph-card" v-for="type in CHINESE_CONTENT.types" :key="type.typeId">
          {{ type.label }}
        </div>
        <p class="ph-note">语文教材、单元、题型与预设尚未接入，这里先按数学页面的结构留位。</p>
        <div class="ph-presets">
          <div class="ph-preset" v-for="preset in CHINESE_CONTENT.presets" :key="preset.id">
            <b>{{ preset.name }}</b>
            <small>{{ preset.total }} 题</small>
          </div>
        </div>
      </section>
    </div>

    <div class="foot">
      <div class="summary">{{ PLACEHOLDER_TEXT }} · 本版本不会生成语文试卷</div>
      <button class="generate" @click="emit('generate')">生成练习卷</button>
    </div>
  </div>
</template>

<style scoped>
.params {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.params-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 8px;
}
section {
  flex: none;
}
section + section {
  margin-top: 28px;
}
h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #111;
}
.ph-unit,
.ph-card {
  display: flex;
  align-items: center;
  width: 100%;
  height: 36px;
  padding: 0 14px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background: #fff;
  color: #777;
  font-size: 13px;
}
.ph-card {
  margin-bottom: 8px;
}
.ph-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #777;
}
.ph-presets {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 12px;
}
.ph-preset {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  color: #777;
  font-size: 12px;
}
.ph-preset b {
  font-size: 13px;
  font-weight: 600;
  color: #777;
}
.foot {
  flex: none;
  padding: 12px 20px 16px;
  border-top: 1px solid #e3e3e3;
  background: #fff;
}
.summary {
  text-align: center;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
}
.generate {
  width: 100%;
  height: 36px;
  margin-top: 8px;
  border: 1px solid #111;
  border-radius: 6px;
  background: #111;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
</style>
