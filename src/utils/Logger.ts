import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// Ensure log directory exists
if (!fs.existsSync(config.log.dir)) {
  fs.mkdirSync(config.log.dir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: config.log.level,
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    // File transport - all logs
    new winston.transports.File({
      filename: path.join(config.log.dir, 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // File transport - errors only
    new winston.transports.File({
      filename: path.join(config.log.dir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    // File transport - audit logs
    new winston.transports.File({
      filename: path.join(config.log.dir, 'audit.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
  ],
});

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(message: string): string {
    return `[${this.context}] ${message}`;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    logger.info(this.formatMessage(message), meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    logger.warn(this.formatMessage(message), meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    logger.error(this.formatMessage(message), meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    logger.debug(this.formatMessage(message), meta);
  }

  audit(action: string, details: Record<string, unknown>): void {
    logger.info(this.formatMessage(`AUDIT: ${action}`), {
      audit: true,
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}

export default logger;
