export interface TrafficPoint {
  ts: string;
  rx_bytes: number;
  tx_bytes: number;
  conns?: number;
}

export interface WanTrafficResponse {
  iface: string;
  granularity: Granularity;
  from: string;
  to: string;
  points: TrafficPoint[];
}

export interface WanSummary {
  iface: string;
  from: string;
  to: string;
  total_rx: number;
  total_tx: number;
  peak_rx: number;
  peak_tx: number;
  avg_rx: number;
  avg_tx: number;
  samples: number;
}

export interface Device {
  mac: string;
  hostname: string | null;
  ip: string | null;
  vendor: string | null;
  rx_bytes: number;
  tx_bytes: number;
  total_bytes: number;
  conns: number;
  last_active: string | null;
}

export interface DeviceListResponse {
  from: string;
  to: string;
  sortBy: string;
  order: string;
  devices: Device[];
}

export interface ProtocolStat {
  layer7: string;
  rx_bytes: number;
  tx_bytes: number;
  total_bytes: number;
  conns: number;
}

export interface DeviceProtocolResponse {
  mac: string;
  from: string;
  to: string;
  protocols: ProtocolStat[];
}

export type Granularity = 'minute' | 'hour' | 'day';

export type SortBy = 'total' | 'rx' | 'tx' | 'conns';
export type Order = 'desc' | 'asc';
