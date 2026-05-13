<template>
  <div>
    <div class="card">
      <h3 class="card-title">设备列表 <span class="muted" style="font-weight: normal">(窗口内统计,点击行查看详情)</span></h3>
      <div class="toolbar">
        <label>时间范围:</label>
        <DateRangePicker v-model="range" @visible-change="rangePickerOpen = $event" />
      </div>
      <div v-if="loading" class="muted" style="text-align: center; padding: 40px">加载中…</div>
      <div v-else-if="error" style="color: #dc2626; padding: 12px">{{ error }}</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th @click="setSort('total')">主机名 / MAC</th>
            <th class="right" @click="setSort('rx')">
              下行 {{ sortArrow('rx') }}
            </th>
            <th class="right" @click="setSort('tx')">
              上行 {{ sortArrow('tx') }}
            </th>
            <th class="right" @click="setSort('total')">
              总计 {{ sortArrow('total') }}
            </th>
            <th class="right" @click="setSort('conns')">
              连接峰值 {{ sortArrow('conns') }}
            </th>
            <th>最近活跃</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="d in devices"
            :key="d.mac"
            style="cursor: pointer"
            @click="open(d.mac)"
          >
            <td>
              <div>{{ d.hostname || '?未识别' }}</div>
              <div class="mono muted">{{ d.mac }} <span v-if="d.ip">/ {{ d.ip }}</span></div>
            </td>
            <td class="right mono">{{ fmtBytes(d.rx_bytes) }}</td>
            <td class="right mono">{{ fmtBytes(d.tx_bytes) }}</td>
            <td class="right mono"><b>{{ fmtBytes(d.total_bytes) }}</b></td>
            <td class="right mono">{{ d.conns }}</td>
            <td class="muted mono">{{ d.last_active || '-' }}</td>
          </tr>
          <tr v-if="!devices.length">
            <td colspan="6" class="muted" style="text-align: center; padding: 20px">
              暂无设备数据(等待第二次 nlbw 采样后才会有差分)
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import DateRangePicker from '../components/DateRangePicker.vue';
import { listDevices } from '../api/devices';
import { mysqlNow, fmtBytes } from '../utils/format';
import type { Device, SortBy, Order } from '../types';

const router = useRouter();
// 默认最近 24 小时
const range = ref<[Date, Date]>([new Date(Date.now() - 24 * 3600 * 1000), new Date()]);
const sortBy = ref<SortBy>('total');
const order = ref<Order>('desc');
const devices = ref<Device[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const rangePickerOpen = ref(false);

function setSort(field: SortBy) {
  if (sortBy.value === field) {
    order.value = order.value === 'desc' ? 'asc' : 'desc';
  } else {
    sortBy.value = field;
    order.value = 'desc';
  }
}

function sortArrow(field: SortBy): string {
  if (sortBy.value !== field) return '';
  return order.value === 'desc' ? '↓' : '↑';
}

function open(mac: string) {
  router.push(`/devices/${mac}`);
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const data = await listDevices({
      from: mysqlNow(range.value[0]),
      to: mysqlNow(range.value[1]),
      sortBy: sortBy.value,
      order: order.value,
    });
    devices.value = data.devices;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

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
watch([range, sortBy, order], load);

let timer: number | undefined;
onMounted(() => {
  timer = window.setInterval(async () => {
    if (rangePickerOpen.value) return;
    if (!tickRange()) await load();
  }, 60_000);
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>
