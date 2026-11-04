import express, { type Express } from "express";
import { securityHeaders } from "./middleware/securityHeaders";

/**
 * The middleware every request passes before the API routes: security headers, body parsing, the
 * HTTPS redirect and the two static folders. server/index.ts mounts it after the request log and
 * the health checks; tests build on it the same way.
 */
export function applyMiddleware(app: Express): void {
  app.use(securityHeaders());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use((req, res, next) => {
    // HSTS comes from helmet above.
    if (process.env.NODE_ENV === 'production') {
      const forwardedProto = req.get('X-Forwarded-Proto');
      if (forwardedProto && forwardedProto !== 'https') {
        const host = req.headers.host;
        const redirectUrl = `https://${host}${req.originalUrl}`;
        return res.redirect(301, redirectUrl);
      }
    }
    next();
  });

  // Serve uploaded files statically
  app.use('/uploads', express.static('public/uploads'));

  // The two constituency map files. Not at /assets: that is where Vite puts the hashed bundles.
  app.use('/geo', express.static('public/assets'));
}
