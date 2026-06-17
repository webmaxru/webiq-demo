import { Router } from 'express';
import type { MetaResponse } from '../contract';
import { registry } from '../endpoints/registry';
import { toMeta } from '../endpoints/types';
import { env } from '../env';

export const metaRouter = Router();

metaRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    keyConfigured: env.keyConfigured,
    auth: env.authMode,
    node: process.version,
  });
});

metaRouter.get('/meta', (_req, res) => {
  const response: MetaResponse = {
    endpoints: registry.map(toMeta),
    keyConfigured: env.keyConfigured,
    auth: env.authMode,
  };

  res.json(response);
});
