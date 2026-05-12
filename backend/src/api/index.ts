import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import wanRouter from './wan.js';
import devicesRouter from './devices.js';
import healthRouter from './health.js';
import { child } from '../utils/logger.js';

const log = child('api');

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    log.debug({ method: req.method, url: req.url }, 'http');
    next();
  });

  app.use('/api/health', healthRouter);
  app.use('/api/wan', wanRouter);
  app.use('/api/devices', devicesRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error({ err: err.message, stack: err.stack }, 'API 异常');
    res.status(500).json({ error: err.message });
  });

  return app;
}
