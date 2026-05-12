import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [[s]] = await pool.query<any[]>(
      `SELECT
         (SELECT COUNT(*) FROM iface_traffic) AS iface_rows,
         (SELECT COUNT(*) FROM device_traffic) AS device_rows,
         (SELECT COUNT(*) FROM device_info) AS device_count,
         (SELECT MAX(ts) FROM iface_traffic) AS last_iface_ts,
         (SELECT MAX(ts) FROM device_traffic) AS last_device_ts,
         (SELECT ts FROM collector_log WHERE job='iface' AND status='ok' ORDER BY ts DESC LIMIT 1) AS last_iface_ok,
         (SELECT ts FROM collector_log WHERE job='nlbw' AND status='ok' ORDER BY ts DESC LIMIT 1) AS last_nlbw_ok`
    );
    res.json({ status: 'ok', ...s });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
