import type { ResultSetHeader } from 'mysql2';
import { pool } from '../db/pool.js';
import { config } from '../config/index.js';
import { child } from '../utils/logger.js';

const log = child('retention-job');

export async function runRetentionJob(): Promise<void> {
  const t0 = Date.now();
  const days = config.retention.days;

  if (days <= 0) {
    log.warn({ days }, '数据保留天数配置无效,跳过清理');
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [deviceResult] = await conn.execute<ResultSetHeader>(
      `DELETE FROM device_traffic WHERE ts < NOW() - INTERVAL ? DAY`,
      [days]
    );
    const [ifaceResult] = await conn.execute<ResultSetHeader>(
      `DELETE FROM iface_traffic WHERE ts < NOW() - INTERVAL ? DAY`,
      [days]
    );
    const [logResult] = await conn.execute<ResultSetHeader>(
      `DELETE FROM collector_log WHERE ts < NOW() - INTERVAL ? DAY`,
      [days]
    );

    await conn.commit();

    const rowsAffected =
      (deviceResult.affectedRows ?? 0) +
      (ifaceResult.affectedRows ?? 0) +
      (logResult.affectedRows ?? 0);
    const dur = Date.now() - t0;

    log.info(
      {
        days,
        deviceRows: deviceResult.affectedRows ?? 0,
        ifaceRows: ifaceResult.affectedRows ?? 0,
        logRows: logResult.affectedRows ?? 0,
        dur,
      },
      '数据保留清理完成'
    );

    await pool.execute(
      `INSERT INTO collector_log (job, status, duration_ms, rows_affected) VALUES (?, ?, ?, ?)`,
      ['retention', 'ok', dur, rowsAffected]
    );
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
