<template>
  <div>
    <div class="card" style="display: flex; align-items: center; justify-content: space-between">
      <div>
        <h3 class="card-title" style="margin-bottom: 4px">
          {{ device?.hostname || '?未识别设备' }}
        </h3>
        <div class="mono muted">
          {{ mac }}
          <span v-if="device?.ip">/ {{ device.ip }}</span>
          <span v-if="device?.vendor">/ {{ device.vendor }}</span>
        </div>
      </div>
      <button class="btn" @click="$router.push('/devices')">← 返回列表</button>
    </div>

    <div class="card">
      <h3 class="card-title">流量趋势</h3>
      <GranularitySelector
        v-model="granularity"
        :range="range"
        :yMode="yMode"
        showYMode
        @update:range="range = $event"
        @update:yMode="yMode = $event"
      />
      <div v-if="loadingTraffic" class="muted" style="text-align: center; padding: 40px">加载中…</div>
      <div v-else-if="!traffic?.points.length" class="muted" style="text-align: center; padding: 40px">
        该设备在选定窗口内没有流量
      </div>
      <BandwidthChart v-else :points="traffic.points" :granularity="granularity" :yMode="yMode" />
    </div>

    <div class="card">
      <h3 class="card-title">协议分布(在干嘛)</h3>
      <div v-if="loadingProto" class="muted" style="text-align: center; padding: 40px">加载中…</div>
      <div v-else-if="!protocols.length" class="muted" style="text-align: center; padding: 40px">无数据</div>
      <div v-else style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: center">
        <div ref="pieEl" class="chart-host" style="height: 320px"></div>
        <table class="data-table">
          <thead>
            <tr>
              <th>协议</th>
              <th class="right">下行</th>
              <th class="right">上行</th>
              <th class="right">总计</th>
              <th class="right">连接峰值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in protocols" :key="p.layer7">
              <td>{{ p.layer7 === '__other__' ? '(其他)' : p.layer7 }}</td>
              <td class="right mono">{{ fmtBytes(p.rx_bytes) }}</td>
              <td class="right mono">{{ fmtBytes(p.tx_bytes) }}</td>
              <td class="right mono"><b>{{ fmtBytes(p.total_bytes) }}</b></td>
              <td class="right mono">{{ p.conns }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as echarts from 'echarts';
import BandwidthChart from '../components/BandwidthChart.vue';
import GranularitySelector from '../components/GranularitySelector.vue';
import { getDevice, getDeviceTraffic, getDeviceProtocols } from '../api/devices';
import { fmtBytes, mysqlNow } from '../utils/format';
import type { Granularity, ProtocolStat, WanTrafficResponse } from '../types';

const props = defineProps<{ mac: string }>();

const device = ref<Awaited<ReturnType<typeof getDevice>> | null>(null);
const traffic = ref<WanTrafficResponse | null>(null);
const protocols = ref<ProtocolStat[]>([]);
const granularity = ref<Granularity>('hour');
// 默认最近 24 小时
const range = ref<[Date, Date]>([new Date(Date.now() - 24 * 3600 * 1000), new Date()]);
const yMode = ref<'bytes' | 'bps'>('bytes');
const loadingTraffic = ref(false);
const loadingProto = ref(false);

const pieEl = ref<HTMLDivElement | null>(null);
let pieChart: echarts.ECharts | null = null;

async function loadDevice() {
  try {
    device.value = await getDevice(props.mac);
  } catch {
    device.value = null;
  }
}

async function loadTraffic() {
  loadingTraffic.value = true;
  try {
    traffic.value = await getDeviceTraffic(props.mac, {
      granularity: granularity.value,
      from: mysqlNow(range.value[0]),
      to: mysqlNow(range.value[1]),
    });
  } finally {
    loadingTraffic.value = false;
  }
}

async function loadProtocols() {
  loadingProto.value = true;
  try {
    const r = await getDeviceProtocols(props.mac, {
      from: mysqlNow(range.value[0]),
      to: mysqlNow(range.value[1]),
    });
    protocols.value = r.protocols;
    await nextTick();
    renderPie();
  } finally {
    loadingProto.value = false;
  }
}

function renderPie() {
  if (!pieEl.value) return;
  if (!pieChart) pieChart = echarts.init(pieEl.value);
  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}<br/><b>${fmtBytes(p.value)}</b> (${p.percent}%)`,
    },
    legend: { orient: 'vertical', right: 0, top: 'middle' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: protocols.value.map((p) => ({
          name: p.layer7 === '__other__' ? '其他' : p.layer7,
          value: p.total_bytes,
        })),
      },
    ],
  });
}

onMounted(async () => {
  await loadDevice();
  await Promise.all([loadTraffic(), loadProtocols()]);
});

watch([granularity, range], loadTraffic);
watch(range, loadProtocols);
watch(() => props.mac, async () => {
  await loadDevice();
  await Promise.all([loadTraffic(), loadProtocols()]);
});

onBeforeUnmount(() => {
  pieChart?.dispose();
});
</script>
