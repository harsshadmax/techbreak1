import cors from 'cors';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/errors';
import appRoutes from './modules/apps/apps.routes';
import authRoutes from './modules/auth/auth.routes';
import challengeRoutes from './modules/challenges/challenges.routes';
import goalRoutes from './modules/goals/goals.routes';
import rewardRoutes from './modules/rewards/rewards.routes';
import sessionRoutes from './modules/sessions/sessions.routes';
import socialRoutes from './modules/social/social.routes';
import tokenRoutes from './modules/tokens/tokens.routes';
import userRoutes from './modules/users/users.routes';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins.includes('*') ? true : env.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const api = Router();
  api.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }), authRoutes);

  api.use(requireAuth);
  api.use('/me', userRoutes);
  api.use('/sessions', sessionRoutes);
  api.use('/goals', goalRoutes);
  api.use('/tokens', tokenRoutes);
  api.use('/challenges', challengeRoutes);
  api.use('/apps', appRoutes);
  api.use(rewardRoutes); // /rewards, /inventory, /donations
  api.use(socialRoutes); // /leaderboard, /friends

  app.use('/api/v1', api);
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
