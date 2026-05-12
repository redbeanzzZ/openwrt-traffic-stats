import { Client, type ClientChannel } from 'ssh2';
import { config } from '../config/index.js';
import { child } from '../utils/logger.js';

const log = child('ssh');

/**
 * 维持一条长连接到路由器,所有 exec 命令复用同一会话。
 * 断开时自动重连,带退避。
 */
class RouterSSH {
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;
  private retryDelay = 1000;

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<Client>((resolve, reject) => {
      const c = new Client();
      c.on('ready', () => {
        log.info({ host: config.router.host }, 'SSH 连接已建立');
        this.client = c;
        this.connecting = null;
        this.retryDelay = 1000;
        resolve(c);
      });
      c.on('error', (err) => {
        log.error({ err: err.message }, 'SSH 连接出错');
        this.client = null;
        this.connecting = null;
        reject(err);
      });
      c.on('close', () => {
        log.warn('SSH 连接已关闭');
        this.client = null;
      });
      c.on('end', () => {
        log.warn('SSH 连接已结束');
        this.client = null;
      });

      c.connect({
        host: config.router.host,
        port: config.router.port,
        username: config.router.user,
        password: config.router.password,
        readyTimeout: 10_000,
        keepaliveInterval: 30_000,
      });
    });

    return this.connecting;
  }

  /**
   * 执行远程命令,返回 stdout。出错抛异常。
   * 失败一次后会自动重连重试一次。
   */
  async exec(cmd: string): Promise<string> {
    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const client = await this.getClient();
        return await this.execOnce(client, cmd);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn({ cmd, attempt, err: msg }, 'exec 失败');
        this.client = null;
        if (attempt >= 2) throw err;
        await new Promise((r) => setTimeout(r, this.retryDelay));
        this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
      }
    }
  }

  private execOnce(client: Client, cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.exec(cmd, (err, stream: ClientChannel) => {
        if (err) return reject(err);
        let out = '';
        let errOut = '';
        stream.on('data', (d: Buffer) => {
          out += d.toString('utf8');
        });
        stream.stderr.on('data', (d: Buffer) => {
          errOut += d.toString('utf8');
        });
        stream.on('close', (code: number) => {
          if (code === 0) resolve(out);
          else reject(new Error(`exit ${code}: ${errOut.trim() || out.trim()}`));
        });
      });
    });
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
}

export const routerSSH = new RouterSSH();
