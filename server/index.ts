import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { checkDatabaseConnection } from "./db";
import { logger } from "./utils/logger";

const app = express();
app.set('trust proxy', 1);

// Request-level structured logging (pino-http). Logs timestamp, level, method,
// url, status code, duration (responseTime) and request id for every request.
const httpLogger = pinoHttp<Request, Response>({
  logger,
  autoLogging: {
    ignore: (req) =>
      req.url?.startsWith('/health') || req.url?.startsWith('/_health') || false,
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: (req, res) => ({
    route: `${req.method} ${(req.originalUrl || req.url || '').split('?')[0]}`,
    userId:
      (req as any).session?.userId ?? (req as any).user?.id ?? undefined,
  }),
});
app.use(httpLogger);

// Simple health check - responds immediately before any middleware
app.get('/health', (req, res) => {
  logger.info({ route: 'GET /health' }, 'Health check received');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/_health', (req, res) => {
  logger.info({ route: 'GET /_health' }, 'Health check received');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

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

// Serve static assets (GeoJSON files, etc.)
app.use('/assets', express.static('public/assets'));

(async () => {
  try {
    logger.info('Starting server initialization...');
    
    // Test Supabase database connection (non-blocking)
    if (process.env.DATABASE_URL) {
      logger.info('Testing Supabase connection...');
      checkDatabaseConnection().catch(err => {
        logger.error({ err }, "Database connection test failed (server will continue)");
      });
    } else {
      logger.warn("No DATABASE_URL configured - database features will not work");
    }
    
    const server = await registerRoutes(app);
    logger.info('Routes registered successfully');

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === "development") {
      logger.info("Setting up Vite development server...");
      await setupVite(app, server);
      logger.info("Vite setup complete");
    } else {
      logger.info("Setting up static file serving...");
      serveStatic(app);
    }

    // Import error handling middleware
    const { errorHandler } = await import('./middleware/errorHandler');
    
    // Centralized error handler (must be AFTER Vite middleware)
    app.use(errorHandler);

    // Initialize Scheduler (news ingest, TD scoring, parliament sync, daily briefing).
    // SCHEDULER=off for a local run against the shared GlasCore database, so looking at the
    // site never triggers a scoring run that changes real TD scores.
    if (process.env.SCHEDULER === 'off') {
      logger.warn('SCHEDULER=off: no scheduled jobs will run');
    } else {
      const { initScheduler } = await import('./services/scheduler');
      initScheduler();
    }

    // serve the app on port 5000 in development, or use the environment variable in production
    // this serves both the API and the client.
    const port = parseInt(process.env.PORT || '5000');
    const host = '0.0.0.0'; // Bind to all interfaces (IPv4 and IPv6)
    
    // Check if port is available before starting
    const serverInstance = server.listen(port, host, () => {
      logger.info({ port }, `Server successfully started on http://localhost:${port}`);
    });

    // Handle server errors
    serverInstance.on('error', (error: unknown) => {
      logger.error({ err: error }, "Server error:");
      if ((error as { code?: string } | null)?.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`);
        logger.error(`Wait for previous process to exit or run: taskkill /F /IM node.exe`);
        process.exit(1);
      }
    });

    // Enhanced graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);
      
      // Stop accepting new connections
      if (serverInstance.listening) {
        serverInstance.close(() => {
          logger.info('HTTP server closed');
        });
      }

      // Give active requests time to finish (5 seconds max)
      setTimeout(() => {
        logger.info('Forcing shutdown after timeout');
        process.exit(0);
      }, 5000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    logger.error(
      { err: error, stack: error instanceof Error ? error.stack : undefined },
      "Failed to start server"
    );
    process.exit(1);
  }
})().catch((error) => {
  logger.error({ err: error }, "Unhandled server startup error:");
  process.exit(1);
});
