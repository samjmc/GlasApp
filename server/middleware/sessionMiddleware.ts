import session from 'express-session';
import { Request, Response, NextFunction } from 'express';

// A predictable secret lets anyone mint a valid session cookie signature.
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}

// Session auth is legacy: the frontend only uses Supabase bearer tokens, so no real user
// ever has req.session.userId. Memory store only — never create a `sessions` table in
// the shared GlasCore database for a code path nothing uses. The auth rebuild removes this.
/** Express session middleware backed by a memory store. */
export const sessionMiddleware = session({
  store: new session.MemoryStore(),
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
/** Express middleware checking session or bearer-token authentication. */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  // Check 1: Session-based auth (Replit)
  if (req.session && req.session.userId) {
    // Expose a minimal identity so downstream role checks can read req.user.
    req.user = { id: req.session.userId, sub: String(req.session.userId) };
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
