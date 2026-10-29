import { Router } from 'express';
import { z } from 'zod';
import { isValidTimeZone } from '../../utils/date';
import * as auth from './auth.service';

const router = Router();

const timezone = z.string().refine(isValidTimeZone, 'unknown time zone').optional();

const usernameRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Username must be 3-20 letters, numbers or underscores');

const registerBody = z.object({
  email: z.string().email(),
  username: usernameRule.optional(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(40),
  timezone,
});

router.post('/register', async (req, res) => {
  res.status(201).json(await auth.register(registerBody.parse(req.body)));
});

/** `identifier` is an email or a username; `email` is still accepted for older clients. */
const loginBody = z
  .object({ identifier: z.string().trim().min(1).optional(), email: z.string().trim().min(1).optional(), password: z.string().min(1) })
  .refine((b) => b.identifier ?? b.email, 'Enter your email or username');

router.post('/login', async (req, res) => {
  const body = loginBody.parse(req.body);
  res.json(await auth.login((body.identifier ?? body.email)!, body.password));
});

const googleBody = z.object({ idToken: z.string().min(1), timezone });

router.post('/google', async (req, res) => {
  const { idToken, timezone: tz } = googleBody.parse(req.body);
  res.json(await auth.loginWithGoogle(idToken, tz));
});

const refreshBody = z.object({ refreshToken: z.string().min(1) });

router.post('/refresh', async (req, res) => {
  res.json(await auth.refresh(refreshBody.parse(req.body).refreshToken));
});

router.post('/logout', async (req, res) => {
  await auth.logout(refreshBody.parse(req.body).refreshToken);
  res.status(204).end();
});

export default router;
