import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Extend Express User type for Replit Auth
declare global {
  namespace Express {
    interface User {
      claims?: {
        sub: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
        exp?: number;
      };
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    }
  }
}

// Make Replit auth optional - skip if not in Replit environment
const isReplitEnvironment = !!process.env.REPLIT_DOMAINS;

if (!isReplitEnvironment) {
  console.warn("⚠️  REPLIT_DOMAINS not set - Replit Auth disabled. Using local development mode.");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Only use database session store if DATABASE_URL is available
  const sessionConfig: any = {
    secret: process.env.SESSION_SECRET || 'dev-secret-please-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  };

  if (process.env.DATABASE_URL) {
    const pgStore = connectPg(session);
    sessionConfig.store = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    console.warn('⚠️  No DATABASE_URL - using memory session store (not recommended for production)');
  }

  return session(sessionConfig);
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // For now, we'll skip database upsert and just use session data
  // This can be enhanced later once the schema is properly migrated
  console.log('User authenticated:', {
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"]
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Only set up Replit auth if in Replit environment
  if (!isReplitEnvironment) {
    console.log("ℹ️  Skipping Replit Auth setup - running in local development mode");
    return;
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => {
    try {
      cb(null, user);
    } catch (error) {
      console.error("Serialize user error:", error);
      cb(error);
    }
  });
  
  passport.deserializeUser((user: Express.User, cb) => {
    try {
      cb(null, user);
    } catch (error) {
      console.error("Deserialize user error:", error);
      cb(error);
    }
  });

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // In local development (non-Replit), allow all requests for testing
  if (!isReplitEnvironment) {
    console.log("🔓 Local dev mode - bypassing authentication");
    // Mock user for development
    req.user = {
      claims: {
        sub: "dev-user-123",
        email: "dev@localhost",
        first_name: "Dev",
        last_name: "User"
      }
    };
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.claims) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at && now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken && user.expires_at && now > user.expires_at) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (refreshToken) {
    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      console.error("Token refresh failed:", error);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
  }
  
  return next();
};