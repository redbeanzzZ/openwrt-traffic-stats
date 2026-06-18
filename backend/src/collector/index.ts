import { config } from '../config/index.js';
import { runIfaceJob } from './iface-job.js';
import { runNlbwJob } from './nlbw-job.js';
import { runDhcpJob } from './dhcp-job.js';
import { runRetentionJob } from './retention-job.js';
import { pool } from '../db/pool.js';
import { child } from '../utils/logger.js';

const log = child('collector');

let stopping = false;

async function safeRun(name: string, fn: () => Promise<void>): Promise<void> {
  if (stopping) return;
  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ job: name, err: msg }, '任务执行失败');
    try {
      await pool.execute(
        `INSERT INTO collector_log (job, status, error_msg) VALUES (?, 'error', ?)`,
        [name, msg]
      );
    } catch {
      /* ignore */
    }
  }
}

function loop(name: string, intervalSec: number, fn: () => Promise<void>): void {
  // 立刻跑一次,然后定时
  void safeRun(name, fn).then(() => {
    const timer = setInterval(() => {
      void safeRun(name, fn);
    }, intervalSec * 1000);
    timer.unref();
  });
}

export function startCollector(): void {
  log.info(
    {
      iface: config.intervals.iface,
      nlbw: config.intervals.nlbw,
      dhcp: config.intervals.dhcp,
      retention: config.intervals.retention,
      retentionDays: config.retention.days,
    },
    '采集器启动'
  );
  loop('iface', config.intervals.iface, runIfaceJob);
  loop('nlbw', config.intervals.nlbw, runNlbwJob);
  loop('dhcp', config.intervals.dhcp, runDhcpJob);
  loop('retention', config.intervals.retention, runRetentionJob);
}

export function stopCollector(): void {
  stopping = true;
}
