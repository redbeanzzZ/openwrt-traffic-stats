import { routerSSH } from './ssh.js';

export interface DhcpLease {
  mac: string;
  ip: string;
  hostname: string | null;
  expiresAt: number;
}

/** 拉 DHCP 租约 + br-lan 的 MAC(标识路由器自己) */
export async function fetchDhcpLeases(): Promise<DhcpLease[]> {
  const raw = await routerSSH.exec('cat /tmp/dhcp.leases 2>/dev/null || true');
  const out: DhcpLease[] = [];
  for (const line of raw.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [ts, mac, ip, name] = parts;
    out.push({
      expiresAt: Number(ts),
      mac: mac.toLowerCase(),
      ip,
      hostname: name === '*' ? null : name,
    });
  }
  return out;
}

/** 取路由器 br-lan 的 MAC,用于把"路由器自己"在设备列表里加注释 */
export async function fetchRouterMac(): Promise<string | null> {
  const raw = await routerSSH.exec('ip -br link show dev br-lan 2>/dev/null || true');
  const m = raw.match(/([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i);
  return m ? m[1].toLowerCase() : null;
}
