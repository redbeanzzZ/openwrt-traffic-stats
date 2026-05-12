import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`环境变量 ${name} 未设置,请检查 .env`);
  }
  return v;
}

function num(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} 必须是数字,实际:${v}`);
  return n;
}

export const config = {
  router: {
    host: required('ROUTER_HOST'),
    port: num('ROUTER_PORT', 22),
    user: required('ROUTER_USER'),
    password: required('ROUTER_PASSWORD'),
  },
  mysql: {
    host: required('MYSQL_HOST'),
    port: num('MYSQL_PORT', 3306),
    user: required('MYSQL_USER'),
    password: required('MYSQL_PASSWORD'),
    database: required('MYSQL_DB'),
  },
  server: {
    port: num('PORT', 3100),
    env: process.env.NODE_ENV ?? 'development',
  },
  intervals: {
    iface: num('INTERVAL_IFACE_SEC', 60),
    nlbw: num('INTERVAL_NLBW_SEC', 60),
    dhcp: num('INTERVAL_DHCP_SEC', 3600),
  },
  watchIfaces: (process.env.WATCH_IFACES ?? 'pppoe-wan,br-lan')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
