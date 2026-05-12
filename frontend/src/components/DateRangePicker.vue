<template>
  <el-date-picker
    v-model="inner"
    type="datetimerange"
    range-separator="→"
    start-placeholder="开始时间"
    end-placeholder="结束时间"
    format="YYYY-MM-DD HH:mm"
    value-format="x"
    :shortcuts="shortcuts"
    :clearable="false"
    :default-time="defaultTime"
    style="width: 360px"
    @change="onChange"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: [Date, Date] | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [[Date, Date]];
}>();

// el-date-picker 用 value-format="x"(毫秒数字字符串)以避免时区坑;
// 内部代理 [Date, Date] ↔ [number, number]
const inner = computed<[number, number] | null>({
  get() {
    if (!props.modelValue) return null;
    return [props.modelValue[0].getTime(), props.modelValue[1].getTime()];
  },
  set(v) {
    if (!v) return;
    emit('update:modelValue', [new Date(v[0]), new Date(v[1])]);
  },
});

function onChange(val: [number, number] | null) {
  if (!val) return;
  emit('update:modelValue', [new Date(val[0]), new Date(val[1])]);
}

// 起始用 00:00:00,结束用 23:59:59
const defaultTime: [Date, Date] = [
  new Date(2000, 0, 1, 0, 0, 0),
  new Date(2000, 0, 1, 23, 59, 59),
];

// shortcuts 点击时计算一次,不会自动滚动
const shortcuts = [
  {
    text: '最近 1 小时',
    value: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 3600 * 1000);
      return [start, end] as [Date, Date];
    },
  },
  {
    text: '最近 6 小时',
    value: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 6 * 3600 * 1000);
      return [start, end] as [Date, Date];
    },
  },
  {
    text: '最近 24 小时',
    value: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 3600 * 1000);
      return [start, end] as [Date, Date];
    },
  },
  {
    text: '最近 7 天',
    value: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
      return [start, end] as [Date, Date];
    },
  },
  {
    text: '最近 30 天',
    value: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
      return [start, end] as [Date, Date];
    },
  },
  {
    text: '今天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return [start, end] as [Date, Date];
    },
  },
  {
    text: '昨天',
    value: () => {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return [start, end] as [Date, Date];
    },
  },
  {
    text: '本月',
    value: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return [start, end] as [Date, Date];
    },
  },
];
</script>
