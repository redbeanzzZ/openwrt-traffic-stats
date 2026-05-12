import { pool } from '../db/pool.js';
import { fetchNlbw, fetchPeriods, type NlbwRow } from '../router-client/nlbw.js';
import { alignedMysqlDatetime, mysqlDatetime } from '../utils/time.js';
import { child } from '../utils/logger.js';
import { config } from '../config/index.js';

const log = child('nlbw-job');

const KEY_SEP = '||';

function macLayer7Key(mac: string, layer7: string | null): string {
  return `${mac}${KEY_SEP}${layer7 ?? '__other__'}`;
}

function parseMacLayer7Key(key: string): { mac: string; layer7: string } {
  const i = key.indexOf(KEY_SEP);
  return { mac: key.slice(0, i), layer7: key.slice(i + KEY_SEP.length) };
}

/**
 * 把 nlbw 多行(同一 mac 多个 ip/port/proto)聚合到 (mac, layer7) 粒度。
 * layer7 为空时归到 '__other__'。
 */
function aggregateByMacLayer7(rows: NlbwRow[]): Map<string, { rx: bigint; tx: bigint; conns: number }> {
  const map = new Map<string, { rx: bigint; tx: bigint; conns: number }>();
  for (const r of rows) {
    const key = macLayer7Key(r.mac, r.layer7);
    const cur = map.get(key) ?? { rx: 0n, tx: 0n, conns: 0 };
    cur.rx += BigInt(r.rxBytes);
    cur.tx += BigInt(r.txBytes);
    cur.conns += r.conns;
    map.set(key, cur);
  }
  return map;
}

/**
 * 每 10min 跑一次。
 * 流程:
 *   1. 拉 nlbw + 当前 period 列表
 *   2. 写 device_traffic_raw(留底)
 *   3. 跟上次 raw 比对,差分写入 device_traffic
 *   4. 维护 device_info(last_seen, ip_last)
 *   5. 周期切换检测(period_date 变化 → 重置基线)
 */
export async function runNlbwJob(): Promise<void> {
  const t0 = Date.now();
  const now = new Date();
  // 时间桶按采集间隔对齐,改 INTERVAL_NLBW_SEC 时桶大小同步变化
  const tsAligned = alignedMysqlDatetime(now, config.intervals.nlbw);
  const tsRaw = mysqlDatetime(now);

  const rows = await fetchNlbw();
  const periods = await fetchPeriods();
  const currentPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

  // 周期切换检测
  let periodChanged = false;
  if (currentPeriod) {
    const [existing] = await pool.query<any[]>(
      `SELECT period_date FROM nlbwmon_period WHERE is_active = 1`
    );
    const wasActive = (existing as { period_date: string }[]).map((r) => r.period_date);
    if (!wasActive.includes(currentPeriod)) {
      periodChanged = true;
      log.warn({ currentPeriod, was: wasActive }, '检测到 nlbwmon 会计周期切换');
      await pool.execute(`UPDATE nlbwmon_period SET is_active = 0 WHERE is_active = 1`);
      await pool.execute(
        `INSERT IGNORE INTO nlbwmon_period (period_date, is_active) VALUES (?, 1)`,
        [currentPeriod]
      );
    } else {
      await pool.execute(
        `UPDATE nlbwmon_period SET last_seen = NOW() WHERE period_date = ?`,
        [currentPeriod]
      );
    }
  }

  const aggCurrent = aggregateByMacLayer7(rows);

  // 取上一次的聚合值(同 mac, 同 layer7),用于差分
  const [lastTsRows] = await pool.query<any[]>(
    `SELECT MAX(ts) AS last_ts FROM device_traffic_raw`
  );
  const lastTs = (lastTsRows as { last_ts: string | null }[])[0]?.last_ts ?? null;

  let aggLast = new Map<string, { rx: bigint; tx: bigint; conns: number }>();
  if (lastTs && !periodChanged) {
    const [prevRows] = await pool.query<any[]>(
      `SELECT mac, layer7, rx_bytes, tx_bytes, conns FROM device_traffic_raw WHERE ts = ?`,
      [lastTs]
    );
    type PrevRow = { mac: string; layer7: string | null; rx_bytes: string; tx_bytes: string; conns: number };
    aggLast = aggregateByMacLayer7(
      (prevRows as PrevRow[]).map((r) => ({
        family: 0,
        proto: null,
        port: null,
        mac: r.mac,
        ip: null,
        layer7: r.layer7,
        conns: r.conns,
        rxBytes: Number(r.rx_bytes),
        rxPkts: 0,
        txBytes: Number(r.tx_bytes),
        txPkts: 0,
      }))
    );
  }

  const conn = await pool.getConnection();
  let rawCount = 0;
  let deltaCount = 0;
  try {
    await conn.beginTransaction();

    // 1) 写 raw
    for (const r of rows) {
      await conn.execute(
        `INSERT INTO device_traffic_raw
           (ts, mac, ip, family, proto, port, layer7, conns, rx_bytes, rx_pkts, tx_bytes, tx_pkts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tsRaw, r.mac, r.ip, r.family, r.proto, r.port, r.layer7, r.conns, r.rxBytes, r.rxPkts, r.txBytes, r.txPkts]
      );
      rawCount += 1;
    }

    // 2) 写差分(只在有 last 的情况下)
    if (aggLast.size > 0) {
      for (const [key, cur] of aggCurrent.entries()) {
        const { mac, layer7 } = parseMacLayer7Key(key);
        const last = aggLast.get(key) ?? { rx: 0n, tx: 0n, conns: 0 };
        const rxDelta = cur.rx >= last.rx ? cur.rx - last.rx : cur.rx;
        const txDelta = cur.tx >= last.tx ? cur.tx - last.tx : cur.tx;
        if (rxDelta === 0n && txDelta === 0n) continue;
        await conn.execute(
          `INSERT INTO device_traffic (ts, mac, layer7, rx_bytes, tx_bytes, conns)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE rx_bytes = VALUES(rx_bytes), tx_bytes = VALUES(tx_bytes), conns = VALUES(conns)`,
          [tsAligned, mac, layer7, rxDelta.toString(), txDelta.toString(), cur.conns]
        );
        deltaCount += 1;
      }
    }

    // 3) 更新 device_info(last_seen + ip_last)
    const macIp = new Map<string, string | null>();
    for (const r of rows) {
      if (r.ip && r.family === 4 && !macIp.has(r.mac)) macIp.set(r.mac, r.ip);
      else if (!macIp.has(r.mac)) macIp.set(r.mac, r.ip);
    }
    for (const [mac, ip] of macIp.entries()) {
      await conn.execute(
        `INSERT INTO device_info (mac, ip_last, last_seen)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           ip_last = COALESCE(VALUES(ip_last), ip_last),
           last_seen = VALUES(last_seen)`,
        [mac, ip]
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const dur = Date.now() - t0;
  log.info({ rawCount, deltaCount, periodChanged, dur }, 'nlbw job 完成');

  await pool.execute(
    `INSERT INTO collector_log (job, status, duration_ms, rows_affected) VALUES (?, ?, ?, ?)`,
    ['nlbw', 'ok', dur, rawCount]
  );
}
