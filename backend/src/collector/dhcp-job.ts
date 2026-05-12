import { pool } from '../db/pool.js';
import { fetchDhcpLeases, fetchRouterMac } from '../router-client/dhcp.js';
import { child } from '../utils/logger.js';

const log = child('dhcp-job');

/**
 * 每 1h 同步一次 MAC ↔ hostname 映射。
 * 数据源:/tmp/dhcp.leases + br-lan 的 MAC(打上 [router] 前缀)
 */
export async function runDhcpJob(): Promise<void> {
  const t0 = Date.now();
  const leases = await fetchDhcpLeases();
  const routerMac = await fetchRouterMac();

  let updated = 0;
  for (const l of leases) {
    if (!l.hostname) continue;
    await pool.execute(
      `INSERT INTO device_info (mac, hostname, ip_last, last_seen)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         hostname = VALUES(hostname),
         ip_last = VALUES(ip_last),
         last_seen = NOW()`,
      [l.mac, l.hostname, l.ip]
    );
    updated += 1;
  }

  if (routerMac) {
    await pool.execute(
      `INSERT INTO device_info (mac, hostname, last_seen)
       VALUES (?, '[路由器自己]', NOW())
       ON DUPLICATE KEY UPDATE
         hostname = CASE WHEN hostname IS NULL OR hostname = '' THEN '[路由器自己]' ELSE hostname END,
         last_seen = NOW()`,
      [routerMac]
    );
  }

  const dur = Date.now() - t0;
  log.info({ updated, routerMac, dur }, 'dhcp job 完成');

  await pool.execute(
    `INSERT INTO collector_log (job, status, duration_ms, rows_affected) VALUES (?, ?, ?, ?)`,
    ['dhcp', 'ok', dur, updated]
  );
}
