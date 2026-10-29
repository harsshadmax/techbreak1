import { Router } from 'express';
import mongoose from 'mongoose';
import { uid } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';
import { dayKey } from '../../utils/date';
import { APP_CATALOG } from '../tokens/engine';
import { spend } from '../tokens/ledger';
import { User } from '../users/user.model';
import { AppUnlock } from './appUnlock.model';

const router = Router();

/** The catalog, each app with the moment its current unlock ends (null when locked). */
router.get('/', async (req, res) => {
  const now = new Date();
  const active = await AppUnlock.find({ userId: uid(req), expiresAt: { $gt: now } });
  const until = new Map(active.map((u) => [u.appId, u.expiresAt]));
  res.json({
    now,
    items: APP_CATALOG.map((app) => ({ ...app, unlockedUntil: until.get(app.id) ?? null })),
  });
});

/** Spend tokens for a timed unlock. Unlocking an app that is still open is refused, so time never stacks by accident. */
router.post('/:id/unlock', async (req, res) => {
  const userId = uid(req);
  const app = APP_CATALOG.find((a) => a.id === req.params.id);
  if (!app) throw new HttpError(404, 'App not found');

  const result = await mongoose.connection.transaction(async (tx) => {
    const user = await User.findById(userId).session(tx);
    if (!user) throw new HttpError(404, 'User not found');
    const now = new Date();
    if (await AppUnlock.exists({ userId, appId: app.id, expiresAt: { $gt: now } }).session(tx)) {
      throw new HttpError(409, `${app.name} is already unlocked`);
    }
    await spend(userId, app.cost, 'app_unlock', { day: dayKey(now, user.timezone), tx });
    const [unlock] = await AppUnlock.create(
      [{ userId, appId: app.id, tokens: app.cost, startedAt: now, expiresAt: new Date(now.getTime() + app.minutes * 60000) }],
      { session: tx },
    );
    return { unlock, user: await User.findById(userId).session(tx) };
  });

  res.status(201).json(result);
});

export default router;
