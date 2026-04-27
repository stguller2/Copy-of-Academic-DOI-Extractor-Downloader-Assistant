
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env, redactSecrets } from "./config/env";
import { securityHeaders } from "./middleware/securityHeaders";
import { globalLimiter } from "./middleware/rateLimiters";
import { httpLogger, requestIdMiddleware, logger } from "./middleware/logging";

// Routers
import scihubProxy from "./routes/scihubProxy";
import aiScan, { initializeLocalModel } from "./routes/aiScan";
import exportRouter from "./routes/export";

const app = express();

// 1. Initial Early Middlewares
app.use(requestIdMiddleware);
app.use(httpLogger);
app.use(securityHeaders);

// 2. CORS & Cookies
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(cookieParser(env.SESSION_SECRET));

// 3. Rate Limiting & Parsing
app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. API Routes
app.use('/api/scihub', scihubProxy);
app.use('/api/ai', aiScan);
app.use('/api/export', exportRouter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// Metrics - Restricted by IP (Production simulation)
app.get('/api/metrics', (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress;
  
  if (env.NODE_ENV === 'production' && ip !== '127.0.0.1') {
    return res.status(403).send('Forbidden');
  }
  res.json({ uptime: process.uptime(), memory: process.memoryUsage() });
});

// API 404 Handler - MUST be after all API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
});
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errorId = req.id || 'unknown';
  logger.error({ error_id: errorId, message: err.message, stack: env.NODE_ENV === 'development' ? err.stack : undefined }, 'Unhandled Error');
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    id: errorId,
    message: env.NODE_ENV === 'development' ? err.message : 'A generic error occurred. Please contact support.'
  });
});

async function startServer() {
  if (env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
    // Start background model initialization
    initializeLocalModel().catch(err => logger.error({ err }, 'Background Init Failed'));
  });
}

startServer();
