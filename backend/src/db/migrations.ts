import type { RowDataPacket } from 'mysql2';
import { pool } from './pool.js';
import { config } from '../config/index.js';
import { child } from '../utils/logger.js';

const log = child('db-migration');

interface ColumnInfo extends RowDataPacket {
  CHARACTER_MAXIMUM_LENGTH: number | null;
}

export async function runMigrations(): Promise<void> {
  await createDeviceCounterLastTable();
  await widenNlbwProtoColumn();
  await migrateDeviceTrafficRawToCounterLast();
}

async function tableExists(tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
      LIMIT 1`,
    [config.mysql.database, tableName]
  );
  return rows.length > 0;
}

async function createDeviceCounterLastTable(): Promise<void> {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS device_counter_last (
       mac VARCHAR(17) NOT NULL,
       layer7 VARCHAR(32) NOT NULL DEFAULT '__other__' COMMENT '协议,null 占位为 __other__',
       ts DATETIME NOT NULL,
       rx_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
       tx_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
       conns_total INT UNSIGNED NOT NULL DEFAULT 0,
       PRIMARY KEY (mac, layer7),
       KEY idx_ts (ts)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='nlbwmon 累计计数器(差分基准)'`
  );
}

async function widenNlbwProtoColumn(): Promise<void> {
  if (!(await tableExists('device_traffic_raw'))) return;

  const [rows] = await pool.query<ColumnInfo[]>(
    `SELECT CHARACTER_MAXIMUM_LENGTH
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'device_traffic_raw'
        AND COLUMN_NAME = 'proto'`,
    [config.mysql.database]
  );

  const currentLength = rows[0]?.CHARACTER_MAXIMUM_LENGTH;
  if (currentLength == null || currentLength >= 32) return;

  await pool.execute(
    `ALTER TABLE device_traffic_raw
       MODIFY proto VARCHAR(32) DEFAULT NULL COMMENT 'TCP/UDP/IP/IPV6-ICMP'`
  );
  log.info({ from: currentLength, to: 32 }, 'device_traffic_raw.proto 字段已扩容');
}

async function migrateDeviceTrafficRawToCounterLast(): Promise<void> {
  if (!(await tableExists('device_traffic_raw'))) return;

  const [[last]] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(ts) AS last_ts FROM device_traffic_raw`
  );
  const lastTs = last?.last_ts;

  if (lastTs) {
    await pool.execute(
      `INSERT INTO device_counter_last (mac, layer7, ts, rx_total, tx_total, conns_total)
       SELECT mac,
              COALESCE(layer7, '__other__') AS layer7,
              MAX(ts) AS ts,
              SUM(rx_bytes) AS rx_total,
              SUM(tx_bytes) AS tx_total,
              SUM(conns) AS conns_total
         FROM device_traffic_raw
        WHERE ts = ?
        GROUP BY mac, COALESCE(layer7, '__other__')
       ON DUPLICATE KEY UPDATE
              ts = VALUES(ts),
              rx_total = VALUES(rx_total),
              tx_total = VALUES(tx_total),
              conns_total = VALUES(conns_total)`,
      [lastTs]
    );
  }

  await pool.execute(`DROP TABLE device_traffic_raw`);
  log.warn({ lastTs }, 'device_traffic_raw 已迁移为 device_counter_last 并删除');
}
