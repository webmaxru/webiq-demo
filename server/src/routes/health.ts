import { Router } from 'express';
import { env } from '../env';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    keyConfigured: env.keyConfigured,
    auth: env.authMode,
    node: process.version,
  });
});
