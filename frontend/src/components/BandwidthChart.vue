<template>
  <div ref="hostEl" class="chart-host"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { fmtBytes, fmtBps, fmtBytesShort, fmtBpsShort, parseTs } from '../utils/format';
import type { TrafficPoint, Granularity } from '../types';

const props = defineProps<{
  points: TrafficPoint[];
  granularity: Granularity;
  yMode?: 'bytes' | 'bps';
  title?: string;
}>();

const hostEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function bucketSec(g: Granularity): number {
  if (g === 'minute') return 60;
  if (g === 'hour') return 3600;
  return 86400;
}

function buildOption() {
  const yMode = props.yMode ?? 'bytes';
  const sec = bucketSec(props.granularity);
  const xData = props.points.map((p) => p.ts);
  const rx = props.points.map((p) => (yMode === 'bps' ? (p.rx_bytes * 8) / sec : p.rx_bytes));
  const tx = props.points.map((p) => (yMode === 'bps' ? (p.tx_bytes * 8) / sec : p.tx_bytes));
  // tooltip 用完整格式(带单位词),Y 轴用紧凑格式(固定宽度避免遮挡)
  const fmtFull = yMode === 'bps' ? fmtBps : fmtBytes;
  const fmtAxis = yMode === 'bps' ? fmtBpsShort : fmtBytesShort;

  return {
    title: props.title ? { text: props.title, left: 'left', textStyle: { fontSize: 14 } } : undefined,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any[]) => {
        const ts = params[0]?.axisValue ?? '';
        const lines = params.map((p) => `${p.marker} ${p.seriesName}: <b>${fmtFull(p.value)}</b>`);
        return [`<div style="font-weight:600">${ts}</div>`, ...lines].join('<br/>');
      },
    },
    legend: { data: ['下行', '上行'], top: props.title ? 28 : 4 },
    grid: { left: 72, right: 24, bottom: 56, top: 60, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        formatter: (v: string) => {
          const d = parseTs(v);
          const p = (n: number) => String(n).padStart(2, '0');
          if (props.granularity === 'day') return `${d.getMonth() + 1}/${d.getDate()}`;
          if (props.granularity === 'hour') return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:00`;
          return `${p(d.getHours())}:${p(d.getMinutes())}`;
        },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => fmtAxis(v) },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 18, bottom: 18 },
    ],
    series: [
      {
        name: '下行',
        type: 'line',
        smooth: true,
        symbol: 'none',
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2 },
        itemStyle: { color: '#2563eb' },
        data: rx,
      },
      {
        name: '上行',
        type: 'line',
        smooth: true,
        symbol: 'none',
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2 },
        itemStyle: { color: '#16a34a' },
        data: tx,
      },
    ],
  };
}

function render() {
  if (!chart) return;
  chart.setOption(buildOption(), true);
}

onMounted(() => {
  if (!hostEl.value) return;
  chart = echarts.init(hostEl.value);
  render();
  window.addEventListener('resize', resize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
  chart = null;
});

function resize() {
  chart?.resize();
}

watch(() => [props.points, props.granularity, props.yMode], render, { deep: true });
</script>
