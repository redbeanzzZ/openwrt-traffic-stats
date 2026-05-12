/**
 * 把一个 Date 对齐到指定秒数的桶起点
 * alignDownTo(new Date('2026-05-12T10:23:47'), 60) → 2026-05-12T10:23:00
 */
export function alignDownTo(d: Date, bucketSec: number): Date {
  const ms = bucketSec * 1000;
  return new Date(Math.floor(d.getTime() / ms) * ms);
}

/** "YYYY-MM-DD HH:mm:ss" 本地时区,MySQL DATETIME 可直接写入 */
export function mysqlDatetime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/** 把"分钟边界"对齐后转 MySQL 时间字符串 */
export function alignedMysqlDatetime(d: Date, bucketSec: number): string {
  return mysqlDatetime(alignDownTo(d, bucketSec));
}
