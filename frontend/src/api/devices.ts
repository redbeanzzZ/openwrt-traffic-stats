import { http } from './client';
import type {
  DeviceListResponse,
  DeviceProtocolResponse,
  Granularity,
  Order,
  SortBy,
  WanTrafficResponse,
} from '../types';

export function listDevices(params: {
  from?: string;
  to?: string;
  sortBy?: SortBy;
  order?: Order;
}): Promise<DeviceListResponse> {
  return http.get<DeviceListResponse>('/devices', { params }).then((r) => r.data);
}

export function getDevice(mac: string): Promise<{
  mac: string;
  hostname: string | null;
  ip: string | null;
  vendor: string | null;
  first_seen: string;
  last_seen: string;
}> {
  return http.get(`/devices/${mac}`).then((r) => r.data);
}

export function getDeviceTraffic(
  mac: string,
  params: { granularity: Granularity; from?: string; to?: string }
): Promise<WanTrafficResponse> {
  return http.get<WanTrafficResponse>(`/devices/${mac}/traffic`, { params }).then((r) => r.data);
}

export function getDeviceProtocols(
  mac: string,
  params: { from?: string; to?: string }
): Promise<DeviceProtocolResponse> {
  return http.get<DeviceProtocolResponse>(`/devices/${mac}/protocols`, { params }).then((r) => r.data);
}
