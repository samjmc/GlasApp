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

// Authentication middleware
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.userId) {
    return next();
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