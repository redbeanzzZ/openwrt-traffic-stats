import type { RowDataPacket } from 'mysql2';
import { pool } from './pool.js';
import { config } from '../config/index.js';
import { child } from '../utils/logger.js';

const log = child('db-migration');

interface ColumnInfo extends RowDataPacket {
  CHARACTER_MAXIMUM_LENGTH: number | null;
}

export async function runMigrations(): Promise<void> {
  await widenNlbwProtoColumn();
}

async function widenNlbwProtoColumn(): Promise<void> {
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
