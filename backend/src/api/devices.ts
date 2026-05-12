import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

/**
 * GET /api/devices?from=&to=&sortBy=total|rx|tx&order=desc|asc
 * 返回每台设备在 from~to 窗口内的总流量,join 主机名。
 */
router.get('/', async (req, res, next) => {
  try {
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const fromDef = new Date();
    fromDef.setHours(fromDef.getHours() - 24);
    const from = (req.query.from as string) || fromDef.toISOString().slice(0, 19).replace('T', ' ');
    const sortBy = ((req.query.sortBy as string) || 'total').toLowerCase();
    const order = ((req.query.order as string) || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const sortColMap: Record<string, string> = {
      total: 'total_bytes',
      rx: 'rx_bytes',
      tx: 'tx_bytes',
      conns: 'conns',
    };
    const sortCol = sortColMap[sortBy] || 'total_bytes';

    const [rows] = await pool.query<any[]>(
      `SELECT d.mac,
              i.hostname,
              i.ip_last,
              i.vendor,
              COALESCE(SUM(d.rx_bytes), 0) AS rx_bytes,
              COALESCE(SUM(d.tx_bytes), 0) AS tx_bytes,
              COALESCE(SUM(d.rx_bytes), 0) + COALESCE(SUM(d.tx_bytes), 0) AS total_bytes,
              COALESCE(SUM(d.conns), 0) AS conns,
              MAX(d.ts) AS last_active
         FROM device_traffic d
         LEFT JOIN device_info i ON d.mac = i.mac
        WHERE d.ts >= ? AND d.ts <= ?
        GROUP BY d.mac, i.hostname, i.ip_last, i.vendor
        ORDER BY ${sortCol} ${order}`,
      [from, to]
    );

    res.json({
      from,
      to,
      sortBy,
      order: order.toLowerCase(),
      devices: (rows as any[]).map((r) => ({
        mac: r.mac,
        hostname: r.hostname,
        ip: r.ip_last,
        vendor: r.vendor,
        rx_bytes: Number(r.rx_bytes),
        tx_bytes: Number(r.tx_bytes),
        total_bytes: Number(r.total_bytes),
        conns: Number(r.conns),
        last_active: r.last_active,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/devices/:mac - 单设备元信息 */
router.get('/:mac', async (req, res, next) => {
  try {
    const mac = req.params.mac.toLowerCase();
    const [rows] = await pool.query<any[]>(
      `SELECT mac, hostname, ip_last, vendor, first_seen, last_seen FROM device_info WHERE mac = ?`,
      [mac]
    );
    const r = (rows as any[])[0];
    if (!r) {
      res.status(404).json({ error: '设备未找到' });
      return;
    }
    res.json({
      mac: r.mac,
      hostname: r.hostname,
      ip: r.ip_last,
      vendor: r.vendor,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/devices/:mac/traffic?from=&to=&granularity=minute|hour|day
 * 单设备时间序列(用 10min 桶聚合到目标粒度)
 */
router.get('/:mac/traffic', async (req, res, next) => {
  try {
    const mac = req.params.mac.toLowerCase();
    const granularity = ((req.query.granularity as string) || 'hour').toLowerCase();
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const defaultFrom = (() => {
      const d = new Date();
      if (granularity === 'day') d.setDate(d.getDate() - 30);
      else if (granularity === 'hour') d.setDate(d.getDate() - 2);
      else d.setHours(d.getHours() - 1);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    })();
    const from = (req.query.from as string) || defaultFrom;

    let bucketExpr: string;
    switch (granularity) {
      case 'day':
        bucketExpr = "DATE_FORMAT(ts, '%Y-%m-%d 00:00:00')";
        break;
      case 'hour':
        bucketExpr = "DATE_FORMAT(ts, '%Y-%m-%d %H:00:00')";
        break;
      case 'minute':
      default:
        bucketExpr = 'ts';
        break;
    }

    const [rows] = await pool.query<any[]>(
      `SELECT ${bucketExpr} AS ts,
              SUM(rx_bytes) AS rx_bytes,
              SUM(tx_bytes) AS tx_bytes,
              SUM(conns) AS conns
         FROM device_traffic
        WHERE mac = ? AND ts >= ? AND ts <= ?
        GROUP BY ts
        ORDER BY ts ASC`,
      [mac, from, to]
    );

    res.json({
      mac,
      granularity,
      from,
      to,
      points: (rows as any[]).map((r) => ({
        ts: r.ts,
        rx_bytes: Number(r.rx_bytes),
        tx_bytes: Number(r.tx_bytes),
        conns: Number(r.conns),
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/devices/:mac/protocols?from=&to=
 * 单设备协议分布(饼图)
 */
router.get('/:mac/protocols', async (req, res, next) => {
  try {
    const mac = req.params.mac.toLowerCase();
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const fromDef = new Date();
    fromDef.setHours(fromDef.getHours() - 24);
    const from = (req.query.from as string) || fromDef.toISOString().slice(0, 19).replace('T', ' ');

    const [rows] = await pool.query<any[]>(
      `SELECT layer7,
              SUM(rx_bytes) AS rx_bytes,
              SUM(tx_bytes) AS tx_bytes,
              SUM(rx_bytes) + SUM(tx_bytes) AS total_bytes,
              SUM(conns) AS conns
         FROM device_traffic
        WHERE mac = ? AND ts >= ? AND ts <= ?
        GROUP BY layer7
        ORDER BY total_bytes DESC`,
      [mac, from, to]
    );

    res.json({
      mac,
      from,
      to,
      protocols: (rows as any[]).map((r) => ({
        layer7: r.layer7,
        rx_bytes: Number(r.rx_bytes),
        tx_bytes: Number(r.tx_bytes),
        total_bytes: Number(r.total_bytes),
        conns: Number(r.conns),
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
