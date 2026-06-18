<template>
  <div ref="hostEl" class="chart-host"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { fmtBytes, fmtBytesShort, parseTs } from '../utils/format';
import type { TrafficPoint, Granularity } from '../types';

const props = defineProps<{
  points: TrafficPoint[];
  granularity: Granularity;
  range?: [Date, Date] | null;
  title?: string;
}>();

const hostEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatMysql(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function alignBucket(d: Date, granularity: Granularity): Date {
  const next = new Date(d);
  next.setMilliseconds(0);
  if (granularity === 'day') next.setHours(0, 0, 0, 0);
  else if (granularity === 'hour') next.setMinutes(0, 0, 0);
  else next.setSeconds(0, 0);
  return next;
}

function stepBucket(d: Date, granularity: Granularity): Date {
  const next = new Date(d);
  if (granularity === 'day') next.setDate(next.getDate() + 1);
  else if (granularity === 'hour') next.setHours(next.getHours() + 1);
  else next.setMinutes(next.getMinutes() + 1);
  return next;
}

function normalizePoints(): TrafficPoint[] {
  if (props.points.length === 0) return [];

  const byTs = new Map(props.points.map((p) => [formatMysql(alignBucket(parseTs(p.ts), props.granularity)), p]));
  const first = alignBucket(props.range?.[0] ?? parseTs(props.points[0].ts), props.granularity);
  const last = alignBucket(props.range?.[1] ?? parseTs(props.points[props.points.length - 1].ts), props.granularity);
  const normalized: TrafficPoint[] = [];

  for (let cursor = first; cursor.getTime() <= last.getTime(); cursor = stepBucket(cursor, props.granularity)) {
    const ts = formatMysql(cursor);
    const point = byTs.get(ts);
    normalized.push(point ?? { ts, rx_bytes: 0, tx_bytes: 0 });
  }

  return normalized;
}

function formatAxisLabel(v: string): string {
  const d = parseTs(v);
  if (props.granularity === 'day') return `${d.getMonth() + 1}/${d.getDate()}`;
  if (props.granularity === 'hour') return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:00`;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTooltipTitle(v: string): string {
  const d = parseTs(v);
  if (props.granularity === 'day') {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (props.granularity === 'hour') {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
  }
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function buildOption() {
  const points = normalizePoints();
  const xData = points.map((p) => p.ts);
  const rx = points.map((p) => p.rx_bytes);
  const tx = points.map((p) => p.tx_bytes);
  // tooltip 用完整格式(带单位词),Y 轴用紧凑格式(固定宽度避免遮挡)

  return {
    title: props.title ? { text: props.title, left: 'left', textStyle: { fontSize: 14 } } : undefined,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any[]) => {
        const ts = params[0]?.axisValue ?? '';
        const lines = params.map((p) => `${p.marker} ${p.seriesName}: <b>${fmtBytes(p.value)}</b>`);
        return [`<div style="font-weight:600">${formatTooltipTitle(ts)}</div>`, ...lines].join('<br/>');
      },
    },
    legend: { data: ['下行', '上行'], top: props.title ? 28 : 4 },
    grid: { left: 72, right: 24, bottom: 56, top: 60, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        formatter: formatAxisLabel,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => fmtBytesShort(v) },
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

watch(() => [props.points, props.granularity, props.range], render, { deep: true });
</script>
