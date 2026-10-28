import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { uid } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';
import { RULES } from '../tokens/engine';
import { BREAK_KINDS, PLATFORMS, Session } from './session.model';
import { abandonSession, completeSession, reportInterruption, startSession } from './sessions.service';

const router = Router();

const objectId = z.string().refine(Types.ObjectId.isValid, 'invalid id');

const startBody = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('focus'),
    plannedMin: z.number().int().min(RULES.minFocusMin).max(RULES.maxSessionMin),
    platform: z.enum(PLATFORMS).default('web'),
  }),
  z.object({
    type: z.literal('break'),
    breakKind: z.enum(BREAK_KINDS),
    plannedMin: z.number().int().min(1).max(30),
    afterSessionId: objectId.optional(),
    platform: z.enum(PLATFORMS).default('web'),
  }),
]);

router.post('/', async (req, res) => {
  const session = await startSession(uid(req), startBody.parse(req.body));
  res.status(201).json({ session });
});

function sessionId(raw: string): string {
  if (!Types.ObjectId.isValid(raw)) throw new HttpError(400, 'invalid session id');
  return raw;
}

router.patch('/:id/interrupt', async (req, res) => {
  res.json({ session: await reportInterruption(uid(req), sessionId(req.params.id)) });
});

router.post('/:id/complete', async (req, res) => {
  const result = await completeSession(uid(req), sessionId(req.params.id));
  res.json(result);
});

router.post('/:id/abandon', async (req, res) => {
  res.json({ session: await abandonSession(uid(req), sessionId(req.params.id)) });
});

const historyQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

router.get('/', async (req, res) => {
  const { from, to, limit } = historyQuery.parse(req.query);
  const startedAt: Record<string, Date> = {};
  if (from) startedAt.$gte = from;
  if (to) startedAt.$lte = to;
  const filter = { userId: uid(req), ...(from || to ? { startedAt } : {}) };
  res.json({ items: await Session.find(filter).sort({ startedAt: -1 }).limit(limit) });
});

export default router;
