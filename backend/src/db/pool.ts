import mysql from 'mysql2/promise';
import { config } from '../config/index.js';
import { child } from '../utils/logger.js';

const log = child('db');

export const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'local',
  dateStrings: true,
});

export async function pingDb(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    log.info({ host: config.mysql.host, db: config.mysql.database }, 'MySQL 连接 OK');
  } finally {
    conn.release();
  }
}
