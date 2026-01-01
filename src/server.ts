import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { getStorage } from './storage';
import apiRouter from './api';
import { createLogger } from './utils/Logger';
import { AppError } from './utils/errors';

const logger = createLogger('Server');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS
app.use(cors({
  origin: config.app.nodeEnv === 'production' 
    ? false  // Disable in production, serve from same origin
    : true,  // Allow all in development
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  
  next();
});

// Mock user context middleware (replace with actual auth in production)
app.use((req: Request, res: Response, next: NextFunction) => {
  // TODO: Replace with actual authentication
  (req as any).userId = req.headers['x-user-id'] || 'system';
  (req as any).userName = req.headers['x-user-name'] || 'System User';
  (req as any).userEmail = req.headers['x-user-email'];
  next();
});

// API routes
app.use('/api', apiRouter);

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err instanceof Error && 'fields' in err ? { fields: (err as any).fields } : {}),
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: config.app.nodeEnv === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_ERROR',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  });
});

// Server startup
async function startServer(): Promise<void> {
  try {
    // Initialize storage
    logger.info('Initializing storage...');
    await getStorage();
    logger.info('Storage initialized');

    // Start listening
    app.listen(config.app.port, () => {
      logger.info(`Server started`, {
        port: config.app.port,
        environment: config.app.nodeEnv,
        phase: config.app.phase,
        features: {
          qbWrite: config.app.enableQbWrite,
          reconciliation: config.app.enableReconciliation,
        },
      });
      
      logger.info(`Crew Finance Portal running at http://localhost:${config.app.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();

export default app;
