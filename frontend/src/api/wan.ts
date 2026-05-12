import { http } from './client';
import type { Granularity, WanTrafficResponse, WanSummary } from '../types';

export function getWanTraffic(params: {
  granularity: Granularity;
  from?: string;
  to?: string;
  iface?: string;
}): Promise<WanTrafficResponse> {
  return http.get<WanTrafficResponse>('/wan/traffic', { params }).then((r) => r.data);
}

export function getWanSummary(params: { from?: string; to?: string; iface?: string }): Promise<WanSummary> {
  return http.get<WanSummary>('/wan/summary', { params }).then((r) => r.data);
}

export function listIfaces(): Promise<{ iface: string; last_ts: string }[]> {
  return http.get('/wan/ifaces').then((r) => r.data);
}
