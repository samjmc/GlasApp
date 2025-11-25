/**
 * Supabase Authentication Service
 * 
 * This service handles authentication using Supabase Auth
 * Migrated from Replit Auth to Supabase Auth
 */

import type { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate required environment variables
const requiredEnvVars = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(
      `${key} must be set. Please add it to your .env file.`
    );
  }
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);

// Admin client with service role for server-side operations
export const supabaseAdmin: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Extract user from JWT token in request
 */
export async function getUserFromRequest(req: Request): Promise<any | null> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error extracting user from request:', error);
    return null;
  }
}

/**
 * Middleware to check if user is authenticated
 */
export async function isAuthenticated(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
      return;
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed' 
    });
  }
}

/**
 * Middleware to check if user has admin role
 */
export async function isAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
      return;
    }

    // Check if user has admin role in metadata
    const role = user.user_metadata?.role || user.app_metadata?.role;
    
    if (role !== 'admin') {
      res.status(403).json({ 
        success: false,
        message: 'Admin access required' 
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(403).json({ 
      success: false,
      message: 'Access denied' 
    });
  }
}

/**
 * Optional middleware - continues even if not authenticated
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await getUserFromRequest(req);
    if (user) {
      req.user = user;
    }
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
}

/**
 * Sign up a new user
 */
export async function signUp(email: string, password: string, metadata?: any) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: process.env.FRONTEND_URL || 'http://localhost:5000'
    }
  });

  if (error) {
    throw new Error(`Sign up failed: ${error.message}`);
  }

  return data;
}

/**
 * Sign in a user
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error(`Sign in failed: ${error.message}`);
  }

  return data;
}

/**
 * Sign out a user
 */
export async function signOut(accessToken: string) {
  const { error } = await supabase.auth.admin.signOut(accessToken);

  if (error) {
    throw new Error(`Sign out failed: ${error.message}`);
  }

  return { success: true };
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`
  });

  if (error) {
    throw new Error(`Password reset failed: ${error.message}`);
  }

  return data;
}

/**
 * Update user metadata
 */
export async function updateUserMetadata(userId: string, metadata: any) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { user_metadata: metadata }
  );

  if (error) {
    throw new Error(`Update metadata failed: ${error.message}`);
  }

  return data;
}

/**
 * Get user by ID (admin function)
 */
export async function getUserById(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(`Get user failed: ${error.message}`);
  }

  return data;
}

/**
 * Delete user (admin function)
 */
export async function deleteUser(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Delete user failed: ${error.message}`);
  }

  return data;
}

// Export types for TypeScript
export type SupabaseUser = Awaited<ReturnType<typeof getUserById>>['user'];

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}



