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
    />

    <label v-if="showYMode" style="margin-left: 24px">单位:</label>
    <button
      v-if="showYMode"
      class="btn"
      :class="{ active: yMode === 'bytes' }"
      title="显示该时间桶内累计的字节总量"
      @click="$emit('update:yMode', 'bytes')"
    >
      字节
    </button>
    <button
      v-if="showYMode"
      class="btn"
      :class="{ active: yMode === 'bps' }"
      title="显示该时间桶内的平均速率(总字节 × 8 ÷ 桶秒数),不是瞬时峰值"
      @click="$emit('update:yMode', 'bps')"
    >
      bps
    </button>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import DateRangePicker from './DateRangePicker.vue';
import type { Granularity } from '../types';

const props = defineProps<{
  modelValue: Granularity;
  range: [Date, Date] | null;
  yMode?: 'bytes' | 'bps';
  showYMode?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [Granularity];
  'update:range': [[Date, Date]];
  'update:yMode': ['bytes' | 'bps'];
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
