import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { HttpError } from '../../middleware/errors';
import { User, type UserDoc } from '../users/user.model';
import { RefreshToken } from './refreshToken.model';

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function newInviteCode(): string {
  return crypto.randomBytes(5).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X').slice(0, 8);
}

async function issueTokens(user: UserDoc) {
  const accessToken = jwt.sign({}, env.jwtSecret, { subject: user.id, expiresIn: ACCESS_TTL_SEC });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({ userId: user._id, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) });
  return { accessToken, refreshToken, user };
}

export async function register(input: { email: string; password: string; displayName: string; timezone?: string }) {
  if (await User.exists({ email: input.email.toLowerCase() })) throw new HttpError(409, 'An account with that email already exists');
  const user = await User.create({
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
    displayName: input.displayName,
    timezone: input.timezone ?? 'UTC',
    inviteCode: newInviteCode(),
  });
  return issueTokens(user);
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Wrong email or password');
  }
  return issueTokens(user);
}

const googleClient = new OAuth2Client();

export async function loginWithGoogle(idToken: string, timezone?: string) {
  if (!env.googleClientId) throw new HttpError(501, 'Google sign-in is not configured');
  const ticket = await googleClient.verifyIdToken({ idToken, audience: env.googleClientId }).catch(() => {
    throw new HttpError(401, 'Invalid Google token');
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) throw new HttpError(401, 'Google account email is not verified');

  let user = await User.findOne({ email: payload.email.toLowerCase() });
  if (!user) {
    user = await User.create({
      email: payload.email,
      authProvider: 'google',
      displayName: payload.name ?? payload.email.split('@')[0],
      timezone: timezone ?? 'UTC',
      inviteCode: newInviteCode(),
    });
  }
  return issueTokens(user);
}

/** Rotate: the presented refresh token is consumed and a new pair is issued. */
export async function refresh(rawToken: string) {
  const stored = await RefreshToken.findOneAndDelete({ tokenHash: sha256(rawToken), expiresAt: { $gt: new Date() } });
  if (!stored) throw new HttpError(401, 'Invalid refresh token');
  const user = await User.findById(stored.userId);
  if (!user) throw new HttpError(401, 'Invalid refresh token');
  return issueTokens(user);
}

export async function logout(rawToken: string) {
  await RefreshToken.deleteOne({ tokenHash: sha256(rawToken) });
}
