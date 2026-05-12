<template>
  <div>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="label">总下行(窗口内)</div>
        <div class="value">{{ summary ? fmtBytes(summary.total_rx) : '-' }}</div>
      </div>
      <div class="kpi">
        <div class="label">总上行(窗口内)</div>
        <div class="value">{{ summary ? fmtBytes(summary.total_tx) : '-' }}</div>
      </div>
      <div class="kpi">
        <div class="label" title="窗口里下行最猛的那 1 分钟用了多少">下行峰值 · 最忙 1 分钟</div>
        <div class="value">{{ summary ? fmtBytes(summary.peak_rx) : '-' }}</div>
      </div>
      <div class="kpi">
        <div class="label" title="窗口里上行最猛的那 1 分钟用了多少">上行峰值 · 最忙 1 分钟</div>
        <div class="value">{{ summary ? fmtBytes(summary.peak_tx) : '-' }}</div>
      </div>
      <div class="kpi">
        <div class="label" title="窗口里数据库存了多少条 1 分钟记录(理论 1440/天)">采样数 · 1 分钟/条</div>
        <div class="value">{{ summary ? summary.samples : '-' }}</div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">WAN 流量趋势 <span class="muted" style="font-weight: normal">({{ iface }})</span></h3>
      <GranularitySelector
        v-model="granularity"
        :range="range"
        :yMode="yMode"
        showYMode
        @update:range="range = $event"
        @update:yMode="yMode = $event"
        @range-visible-change="rangePickerOpen = $event"
      />
      <div v-if="loading" class="muted" style="text-align: center; padding: 40px">加载中…</div>
      <div v-else-if="error" style="color: #dc2626; padding: 12px">{{ error }}</div>
      <div v-else-if="!traffic?.points.length" class="muted" style="text-align: center; padding: 40px">
        当前窗口暂无数据(采集器是否在跑?或换个粒度试试)
      </div>
      <BandwidthChart v-else :points="traffic.points" :granularity="granularity" :yMode="yMode" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import BandwidthChart from '../components/BandwidthChart.vue';
import GranularitySelector from '../components/GranularitySelector.vue';
import { getWanTraffic, getWanSummary } from '../api/wan';
import { mysqlNow, fmtBytes } from '../utils/format';
import type { Granularity, WanTrafficResponse, WanSummary } from '../types';

const iface = 'pppoe-wan';
const granularity = ref<Granularity>('minute');
// 默认最近 1 小时
const range = ref<[Date, Date]>([new Date(Date.now() - 3600 * 1000), new Date()]);
const yMode = ref<'bytes' | 'bps'>('bps');
const traffic = ref<WanTrafficResponse | null>(null);
const summary = ref<WanSummary | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const rangePickerOpen = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const from = mysqlNow(range.value[0]);
    const to = mysqlNow(range.value[1]);
    const [t, s] = await Promise.all([
      getWanTraffic({ granularity: granularity.value, from, to, iface }),
      getWanSummary({ from, to, iface }),
    ]);
    traffic.value = t;
    summary.value = s;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

/** 若 range 终点贴近 now(60s 内),自动平移窗口跟随当下;返回是否平移 */
function tickRange(): boolean {
  const now = Date.now();
  const [from, to] = range.value;
  if (now - to.getTime() < 60_000) {
    const span = to.getTime() - from.getTime();
    range.value = [new Date(now - span), new Date(now)];
    return true;
  }
  return false;
}

onMounted(load);
watch([granularity, range], load);

let timer: number | undefined;
function setupTimer() {
  if (timer) window.clearInterval(timer);
  const ms = granularity.value === 'minute' ? 30_000 : 60_000;
  timer = window.setInterval(async () => {
    if (rangePickerOpen.value) return;
    // tickRange 改变了 range → watch 会触发 load,否则手动 load 一次
    if (!tickRange()) await load();
  }, ms);
}
onMounted(setupTimer);
watch(granularity, setupTimer);

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>
