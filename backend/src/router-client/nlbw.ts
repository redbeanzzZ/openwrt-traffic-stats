import { routerSSH } from './ssh.js';

export interface NlbwRow {
  family: number;
  proto: string | null;
  port: number | null;
  mac: string;
  ip: string | null;
  layer7: string | null;
  conns: number;
  rxBytes: number;
  rxPkts: number;
  txBytes: number;
  txPkts: number;
}

interface NlbwResponse {
  columns: string[];
  data: Array<Array<number | string | null>>;
}

/** 拉一次 nlbw JSON 输出(当前周期累计) */
export async function fetchNlbw(): Promise<NlbwRow[]> {
  const raw = await routerSSH.exec('/usr/sbin/nlbw -c json');
  const parsed = JSON.parse(raw) as NlbwResponse;
  const idx = (c: string): number => {
    const i = parsed.columns.indexOf(c);
    if (i < 0) throw new Error(`nlbw 返回缺少列 ${c}`);
    return i;
  };
  const I = {
    family: idx('family'),
    proto: parsed.columns.indexOf('proto'),
    port: parsed.columns.indexOf('port'),
    mac: idx('mac'),
    ip: idx('ip'),
    layer7: idx('layer7'),
    conns: idx('conns'),
    rxBytes: idx('rx_bytes'),
    rxPkts: idx('rx_pkts'),
    txBytes: idx('tx_bytes'),
    txPkts: idx('tx_pkts'),
  };

  return parsed.data.map((r) => ({
    family: Number(r[I.family]),
    proto: I.proto >= 0 ? (r[I.proto] as string | null) : null,
    port: I.port >= 0 ? (r[I.port] as number | null) : null,
    mac: String(r[I.mac]).toLowerCase(),
    ip: r[I.ip] as string | null,
    layer7: (r[I.layer7] as string | null) ?? null,
    conns: Number(r[I.conns]),
    rxBytes: Number(r[I.rxBytes]),
    rxPkts: Number(r[I.rxPkts]),
    txBytes: Number(r[I.txBytes]),
    txPkts: Number(r[I.txPkts]),
  }));
}

/** 当前会计周期列表(YYYY-MM-DD,最新的在最后) */
export async function fetchPeriods(): Promise<string[]> {
  const raw = await routerSSH.exec('/usr/sbin/nlbw -c list');
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
}
