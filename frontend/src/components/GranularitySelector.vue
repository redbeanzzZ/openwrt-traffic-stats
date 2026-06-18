<template>
  <div class="toolbar">
    <label>颗粒度:</label>
    <button
      v-for="g in options"
      :key="g.value"
      class="btn"
      :class="{ active: modelValue === g.value }"
      :disabled="isDisabled(g.value)"
      :title="isDisabled(g.value) ? `当前时间跨度太大,不支持 ${g.label} 粒度` : ''"
      @click="$emit('update:modelValue', g.value)"
    >
      {{ g.label }}
    </button>

    <label style="margin-left: 24px">时间范围:</label>
    <DateRangePicker
      :modelValue="range"
      @update:modelValue="$emit('update:range', $event)"
      @visible-change="$emit('range-visible-change', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import DateRangePicker from './DateRangePicker.vue';
import type { Granularity } from '../types';

const props = defineProps<{
  modelValue: Granularity;
  range: [Date, Date] | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [Granularity];
  'update:range': [[Date, Date]];
  'range-visible-change': [boolean];
}>();

const options: { value: Granularity; label: string }[] = [
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' },
  { value: 'day', label: '天' },
];

function spanHours(): number {
  if (!props.range) return 0;
  return (props.range[1].getTime() - props.range[0].getTime()) / 3600_000;
}

function isDisabled(g: Granularity): boolean {
  const h = spanHours();
  if (g === 'minute' && h > 48) return true;
  if (g === 'hour' && h > 30 * 24) return true;
  return false;
}

/** 自动降级:跨度超阈值时,把粒度提到合理档位 */
function autoDowngrade() {
  const h = spanHours();
  let target: Granularity = props.modelValue;
  if (h > 30 * 24 && target !== 'day') target = 'day';
  else if (h > 48 && target === 'minute') target = 'hour';
  if (target !== props.modelValue) emit('update:modelValue', target);
}

watch(() => props.range, autoDowngrade, { immediate: true });
</script>

<style scoped>
button.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
