import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', details: err.flatten().fieldErrors });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Mongo duplicate key
  if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
    res.status(409).json({ error: 'Already exists' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
