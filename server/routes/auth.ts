import type { Express } from "express";

/**
 * Register Supabase authentication routes
 *
 * Note: Authentication is now handled entirely client-side with Supabase Auth.
 * The backend only needs to verify JWT tokens when protecting routes.
 */
export async function registerAuthRoutes(app: Express): Promise<void> {
  // Health check endpoint
  app.get('/api/auth/health', (req, res) => {
    res.json({
      status: 'ok',
      auth: 'supabase',
      message: 'Authentication handled client-side with Supabase Auth'
    });
  });
}
