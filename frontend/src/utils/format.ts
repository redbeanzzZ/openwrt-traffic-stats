/** 把字节数格式化成易读的 B/KB/MB/GB/TB(完整版,用于 tooltip / KPI) */
export function fmtBytes(n: number, digits = 2): string {
  if (!Number.isFinite(n) || n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let v = Math.abs(n);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(digits)} ${units[i]}`;
}

/** 紧凑版:用于 ECharts Y 轴 axisLabel,固定宽度避免被遮挡。"1.5G" / "200M" / "49K" */
export function fmtBytesShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  const units = ['', 'K', 'M', 'G', 'T', 'P'];
  let i = 0;
  let v = Math.abs(n);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const txt = v < 10 ? v.toFixed(1) : Math.round(v).toString();
  return `${txt}${units[i]}`;
}

/** bps,基于"一段时间内的总字节" 除以"这段时间长度",当前最简实现假设 1min 桶 */
export function bpsFromBytes(bytes: number, secondsPerBucket: number): number {
  return (bytes * 8) / secondsPerBucket;
}

export function fmtBps(bps: number): string {
  if (!Number.isFinite(bps)) return '0 bps';
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let i = 0;
  let v = Math.abs(bps);
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i += 1;
  }
  return `${v.toFixed(2)} ${units[i]}`;
}

/** 紧凑版 bps:"1.5G" / "200M" / "49K"(无单位词,因为 Y 轴位置紧) */
export function fmtBpsShort(bps: number): string {
  if (!Number.isFinite(bps) || bps === 0) return '0';
  const units = ['', 'K', 'M', 'G', 'T'];
  let i = 0;
  let v = Math.abs(bps);
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i += 1;
  }
  const txt = v < 10 ? v.toFixed(1) : Math.round(v).toString();
  return `${txt}${units[i]}`;
}

/** 把后端返回的 "YYYY-MM-DD HH:mm:ss" 转成 Date */
export function parseTs(s: string): Date {
  // MySQL DATETIME 没有时区,按本地处理
  return new Date(s.replace(' ', 'T'));
}

/** 当前时间减去若干小时,返回 MySQL 兼容格式 */
export function hoursAgo(hours: number): string {
  const d = new Date(Date.now() - hours * 3600 * 1000);
  return mysqlNow(d);
}

export function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

export function mysqlNow(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}
