import type { Request, Response } from 'express';
import { formatError } from '../utils/responseFormatters';

/**
 * Answers any /api path that no router handled. Mount it after every API router and before
 * the SPA fallback. Without it the fallback returns index.html with a 200, so a caller of a
 * missing endpoint sees success: the contact form said "Message sent" for a route that
 * never existed.
 */
export function apiNotFound(req: Request, res: Response) {
  res.status(404).json(formatError('NOT_FOUND', `No API route for ${req.method} ${req.originalUrl.split('?')[0]}`));
}
