import session from 'express-session';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import connectPgSimple from 'connect-pg-simple';

// Set up PostgreSQL session store (if a pool is available)
const PgSession = connectPgSimple(session);
const sessionStore = pool
  ? new PgSession({
      pool,
      tableName: 'sessions',
      createTableIfMissing: true,
    })
  : new session.MemoryStore();

// Create session middleware
export const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'glas-politics-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  },
});

/**
 * Session-based authentication middleware
 *
 * Checks for authentication via:
 * 1. Express session (from Replit/OAuth)
 * 2. Bearer token in Authorization header (Supabase JWT)
 *
 * This middleware allows multiple auth methods to coexist.
 *
 * Returns:
 * - 200 with next() if authenticated via session or bearer
 * - 401 if neither method succeeds
 */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  // Check 1: Session-based auth (Replit)
  if (req.session && req.session.userId) {
    return next();
  }

  // Check 2: Bearer token auth (Supabase) - fallback
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      // Import and use Supabase bearer validation
      const { getUserFromRequest } = await import('../auth/supabaseAuth.js');
      const user = await getUserFromRequest(req);

      if (user) {
        req.user = user;
        return next();
      }
    } catch (error) {
      console.debug('Bearer token validation failed:', error);
      // Fall through to 401
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};

// Declare session types
declare module 'express-session' {
  interface SessionData {
    userId: number;
    regionCode?: string;
  }
}