import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

/**
 * GET /api/wan/traffic?from=&to=&granularity=minute|hour|day&iface=pppoe-wan
 * 返回 [{ ts, rx_bytes, tx_bytes }]
 */
router.get('/traffic', async (req, res, next) => {
  try {
    const iface = (req.query.iface as string) || 'pppoe-wan';
    const granularity = ((req.query.granularity as string) || 'minute').toLowerCase();
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
      `SELECT ${bucketExpr} AS bucket_ts,
              SUM(rx_bytes) AS rx_bytes,
              SUM(tx_bytes) AS tx_bytes
         FROM iface_traffic
        WHERE iface = ? AND ts >= ? AND ts <= ?
        GROUP BY bucket_ts
        ORDER BY bucket_ts ASC`,
      [iface, from, to]
    );

    res.json({
      iface,
      granularity,
      from,
      to,
      points: (rows as { bucket_ts: string; rx_bytes: string; tx_bytes: string }[]).map((r) => ({
        ts: r.bucket_ts,
        rx_bytes: Number(r.rx_bytes),
        tx_bytes: Number(r.tx_bytes),
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/wan/summary?from=&to=&iface=
 * 返回 KPI 卡片用:总下行、总上行、峰值、平均
 */
router.get('/summary', async (req, res, next) => {
  try {
    const iface = (req.query.iface as string) || 'pppoe-wan';
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const fromDef = new Date();
    fromDef.setHours(fromDef.getHours() - 24);
    const from = (req.query.from as string) || fromDef.toISOString().slice(0, 19).replace('T', ' ');

    const [[s]] = await pool.query<any[]>(
      `SELECT
         COALESCE(SUM(rx_bytes), 0) AS total_rx,
         COALESCE(SUM(tx_bytes), 0) AS total_tx,
         COALESCE(MAX(rx_bytes), 0) AS peak_rx,
         COALESCE(MAX(tx_bytes), 0) AS peak_tx,
         COALESCE(AVG(rx_bytes), 0) AS avg_rx,
         COALESCE(AVG(tx_bytes), 0) AS avg_tx,
         COUNT(*) AS samples
       FROM iface_traffic
       WHERE iface = ? AND ts >= ? AND ts <= ?`,
      [iface, from, to]
    );

    res.json({
      iface,
      from,
      to,
      total_rx: Number(s.total_rx),
      total_tx: Number(s.total_tx),
      peak_rx: Number(s.peak_rx),
      peak_tx: Number(s.peak_tx),
      avg_rx: Number(s.avg_rx),
      avg_tx: Number(s.avg_tx),
      samples: Number(s.samples),
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/wan/ifaces - 当前数据库里有数据的接口列表 */
router.get('/ifaces', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT iface, MAX(ts) AS last_ts FROM iface_traffic GROUP BY iface ORDER BY iface`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
