// Must be first: starts App Insights auto-instrumentation before http/express load.
import { flushAppInsights } from './appInsights';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './env';
import { errorHandler } from './middleware/errorHandler';
import { generalRateLimiter, searchRateLimiter } from './middleware/rateLimit';
import { metaRouter } from './routes/meta';
import { searchRouter } from './routes/search';

const app = express();

// Behind the Container Apps (Envoy) ingress the real client IP arrives in
// X-Forwarded-For. Trust a bounded number of hops so req.ip — and therefore the
// per-IP rate limiter — keys off the actual client rather than the proxy.
app.set('trust proxy', env.trustProxyHops);

// Security headers. CSP is left at helmet's strict defaults except img-src, which
// is widened to https: because the SPA renders external result thumbnails
// (news/image/video) served from third-party CDNs.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: env.webOrigin, credentials: false }));

// Per-IP throttling: a strict limiter on the expensive search endpoints plus a
// looser limiter across the rest of the API (health is skipped inside it).
app.use('/api/search', searchRateLimiter);
app.use('/api', generalRateLimiter);

app.use('/api', metaRouter);
app.use('/api', searchRouter);

app.use('/api/*', (_req, res) => {
  res.status(404).json({
    ok: false,
    endpointId: 'unknown',
    error: {
      class: 'NotFoundError',
      message: 'API route not found.',
    },
  });
});

if (process.env.NODE_ENV === 'production') {
  const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }
}

app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(
    `Web IQ demo server listening on port ${env.port} (key configured: ${env.keyConfigured ? 'yes' : 'no'})`,
  );
});

// Flush telemetry on shutdown (Container Apps sends SIGTERM on revision swap /
// scale-to-zero) so buffered events are not lost.
let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}, flushing telemetry and shutting down…`);
  server.close();
  await flushAppInsights();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
