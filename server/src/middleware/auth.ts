import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from './errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Missing access token');
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) throw new Error('no subject');
    req.userId = payload.sub;
  } catch {
    throw new HttpError(401, 'Invalid or expired access token');
  }
  next();
};

/** The authenticated user's id; only call behind requireAuth. */
export function uid(req: Request): string {
  if (!req.userId) throw new HttpError(401, 'Not authenticated');
  return req.userId;
}
