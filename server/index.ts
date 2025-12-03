import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { checkDatabaseConnection } from "./db";

const app = express();
app.set('trust proxy', 1);

// Simple health check - responds immediately before any middleware
app.get('/health', (req, res) => {
  console.log('🏥 Health check received');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/_health', (req, res) => {
  console.log('🏥 Health check received (_health)');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Log ALL incoming requests for debugging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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

// Serve AI-generated news images
app.use('/news-images', express.static('public/news-images'));

// Serve static assets (GeoJSON files, etc.)
app.use('/assets', express.static('public/assets'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "unserializable response";
          logLine += ` :: [response not serializable: ${message}]`;
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Starting server initialization...");
    
    // Test Supabase database connection (non-blocking)
    if (process.env.DATABASE_URL) {
      log("Testing Supabase connection...");
      checkDatabaseConnection().catch(err => {
        console.error("⚠️  Database connection test failed (server will continue):", err.message);
      });
    } else {
      console.warn("⚠️  No DATABASE_URL configured - database features will not work");
    }
    
    const server = await registerRoutes(app);
    log("Routes registered successfully");

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === "development") {
      log("Setting up Vite development server...");
      await setupVite(app, server);
      log("Vite setup complete");
    } else {
      log("Setting up static file serving...");
      serveStatic(app);
    }

    // Import error handling middleware
    const { errorHandler } = await import('./middleware/errorHandler');
    
    // Centralized error handler (must be AFTER Vite middleware)
    app.use(errorHandler);

    // Initialize Scheduler (Daily Briefing, etc.)
    const { initScheduler } = await import('./services/scheduler');
    initScheduler();

    // serve the app on port 5000 in development, or use the environment variable in production
    // this serves both the API and the client.
    const port = parseInt(process.env.PORT || '5000');
    const host = '0.0.0.0'; // Bind to all interfaces (IPv4 and IPv6)
    
    // Check if port is available before starting
    const serverInstance = server.listen(port, host, () => {
      log(`Server successfully started on http://localhost:${port}`);
    });

    // Handle server errors
    serverInstance.on('error', (error: any) => {
      console.error("Server error:", error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        console.error(`Wait for previous process to exit or run: taskkill /F /IM node.exe`);
        process.exit(1);
      }
    });

    // Enhanced graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      log(`\n${signal} received. Starting graceful shutdown...`);
      
      // Stop accepting new connections
      if (serverInstance.listening) {
        serverInstance.close(() => {
          log('HTTP server closed');
        });
      }

      // Give active requests time to finish (5 seconds max)
      setTimeout(() => {
        log('Forcing shutdown after timeout');
        process.exit(0);
      }, 5000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error("Failed to start server:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace available');
    process.exit(1);
  }
})().catch((error) => {
  console.error("Unhandled server startup error:", error);
  process.exit(1);
});
