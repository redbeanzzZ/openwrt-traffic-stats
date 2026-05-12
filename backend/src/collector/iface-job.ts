import { pool } from '../db/pool.js';
import { fetchIfaceCounters } from '../router-client/iface.js';
import { config } from '../config/index.js';
import { alignedMysqlDatetime, mysqlDatetime } from '../utils/time.js';
import { child } from '../utils/logger.js';

const log = child('iface-job');

interface LastRow {
  iface: string;
  rx_total: string;
  tx_total: string;
  ts: string;
}

/**
 * 每 60s 跑一次:
 *   1. SSH 拉 /proc/net/dev
 *   2. 跟 iface_counter_last 比对算差分
 *   3. 写入 iface_traffic(增量)
 *   4. 更新 iface_counter_last(基准)
 */
export async function runIfaceJob(): Promise<void> {
  const t0 = Date.now();
  const now = new Date();
  // 时间桶按采集间隔对齐,改 INTERVAL_IFACE_SEC 时桶大小同步变化
  const tsAligned = alignedMysqlDatetime(now, config.intervals.iface);

  const counters = await fetchIfaceCounters();
  const watched = counters.filter((c) => config.watchIfaces.includes(c.iface));
  if (watched.length === 0) {
    log.warn({ watch: config.watchIfaces }, '没有关注的接口被采集到,跳过');
    return;
  }

  const [lastRows] = await pool.query<any[]>(
    `SELECT iface, rx_total, tx_total, ts FROM iface_counter_last WHERE iface IN (?)`,
    [watched.map((c) => c.iface)]
  );
  const lastMap = new Map<string, LastRow>(
    (lastRows as LastRow[]).map((r) => [r.iface, r])
  );

  let rowsWritten = 0;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const c of watched) {
      const last = lastMap.get(c.iface);
      // 路由器重启/计数器溢出场景:cur < last → 按 0 起算,只用 cur 当增量
      let rxDelta = 0;
      let txDelta = 0;
      if (last) {
        const lastRx = BigInt(last.rx_total);
        const lastTx = BigInt(last.tx_total);
        const curRx = BigInt(c.rxBytes);
        const curTx = BigInt(c.txBytes);
        rxDelta = Number(curRx >= lastRx ? curRx - lastRx : curRx);
        txDelta = Number(curTx >= lastTx ? curTx - lastTx : curTx);
      }

      if (last) {
        // 只有有"上次值"时才落差分(第一次启动只建基线,丢弃这一行)
        await conn.execute(
          `INSERT INTO iface_traffic (ts, iface, rx_bytes, tx_bytes)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE rx_bytes = VALUES(rx_bytes), tx_bytes = VALUES(tx_bytes)`,
          [tsAligned, c.iface, rxDelta, txDelta]
        );
        rowsWritten += 1;
      }

      await conn.execute(
        `INSERT INTO iface_counter_last (iface, ts, rx_total, tx_total)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ts = VALUES(ts), rx_total = VALUES(rx_total), tx_total = VALUES(tx_total)`,
        [c.iface, mysqlDatetime(now), c.rxBytes, c.txBytes]
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
  log.debug({ rowsWritten, dur }, 'iface job 完成');

  await pool.execute(
    `INSERT INTO collector_log (job, status, duration_ms, rows_affected) VALUES (?, ?, ?, ?)`,
    ['iface', 'ok', dur, rowsWritten]
  );
}
