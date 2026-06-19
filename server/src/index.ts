// Must be first: starts App Insights auto-instrumentation before http/express load.
import { flushAppInsights } from './appInsights';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { env } from './env';
import { errorHandler } from './middleware/errorHandler';
import { metaRouter } from './routes/meta';
import { searchRouter } from './routes/search';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: env.webOrigin, credentials: false }));

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
