import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env';
import { initElasticsearch } from './config/elasticsearch';
import passport from './config/passport';
import { emailQueue } from './queues/emailQueue';
import { startEmailWorker } from './workers/emailWorker';

import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import senderRoutes from './routes/senders';
import slackRoutes from './routes/slack';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { verifySmtpConnection } from './services/emailService';

async function bootstrap(): Promise<void> {
  const app = express();

  // ── Security & parsing ────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Relax for Bull Board UI
    }),
  );
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Session store (Redis) ─────────────────────────────────────────────────
  const redisStoreClient = createClient({
    url: process.env.REDIS_URL,
  });
  await redisStoreClient.connect().catch((e: Error) =>
    logger.warn(`Redis session store connect warning: ${e.message}`),
  );

  app.use(
    session({
      store: new RedisStore({ client: redisStoreClient }),
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );

  // ── Passport ──────────────────────────────────────────────────────────────
  app.use(passport.initialize());
  app.use(passport.session());

  // ── Bull Board ────────────────────────────────────────────────────────────
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  const bullMQAdapter = new BullMQAdapter(emailQueue);
  createBullBoard({
    // @ts-expect-error: BullMQ v5 / bull-board v5 minor type mismatch — works at runtime
    queues: [bullMQAdapter],
    serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // ── API routes ────────────────────────────────────────────────────────────
  app.use('/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/senders', senderRoutes);
  app.use('/api/slack', slackRoutes);

  // ── Error handling ────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ── Start services ────────────────────────────────────────────────────────
  await initElasticsearch();
  await verifySmtpConnection(); // Warn early if SMTP is misconfigured
  startEmailWorker();

  app.listen(Number(env.PORT), '0.0.0.0', () => {
    logger.info(`🚀 ReachInbox backend running on port ${env.PORT}`);
    logger.info(`📋 Bull Board: http://0.0.0.0:${env.PORT}/admin/queues`);
    logger.info(`🔍 Health: http://0.0.0.0:${env.PORT}/health`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});