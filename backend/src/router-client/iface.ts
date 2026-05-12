import { routerSSH } from './ssh.js';

export interface IfaceCounters {
  iface: string;
  rxBytes: number;
  txBytes: number;
  rxPkts: number;
  txPkts: number;
}

/** 拿一次 /proc/net/dev 的全量计数器 */
export async function fetchIfaceCounters(): Promise<IfaceCounters[]> {
  const raw = await routerSSH.exec('cat /proc/net/dev');
  const lines = raw.split('\n');
  const result: IfaceCounters[] = [];
  for (const line of lines) {
    // 跳过表头(前两行)和空行
    const m = line.match(/^\s*(\S+):\s+(.+)$/);
    if (!m) continue;
    const iface = m[1];
    const cols = m[2].split(/\s+/).filter(Boolean);
    if (cols.length < 16) continue;
    // 字段顺序参考 /proc/net/dev:
    //  rx_bytes rx_pkts rx_errs rx_drop rx_fifo rx_frame rx_compressed rx_multicast
    //  tx_bytes tx_pkts tx_errs tx_drop tx_fifo tx_colls tx_carrier tx_compressed
    result.push({
      iface,
      rxBytes: Number(cols[0]),
      rxPkts: Number(cols[1]),
      txBytes: Number(cols[8]),
      txPkts: Number(cols[9]),
    });
  }
  return result;
}
