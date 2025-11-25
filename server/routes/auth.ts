import type { Express } from "express";
import { optionalAuth, isAuthenticated } from "../auth/supabaseAuth";

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

  // Optional: Protected route example
  // Use isAuthenticated middleware for routes that require authentication
  app.get("/api/auth/protected", isAuthenticated, async (req, res) => {
    const user = req.user;
    res.json({ 
      message: "This is a protected route", 
      userId: user?.id,
      email: user?.email 
    });
  });
}