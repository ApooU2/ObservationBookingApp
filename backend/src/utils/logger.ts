import winston from 'winston';
import path from 'path';
import * as fs from 'fs';

// Create logs directory if it doesn't exist
const logDir = process.env.LOG_DIR || (process.env.NODE_ENV === 'production' ? '/var/log/observatory-booking' : './logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'observatory-booking',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Write all logs to files
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'security.log'),
      level: 'warn',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Stream interface for Morgan
export const logStream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

// Performance logging utility
export const logPerformance = (operation: string, startTime: number, metadata?: any) => {
  const duration = Date.now() - startTime;
  logger.info('Performance metric', {
    operation,
    duration,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// Security event logging
export const logSecurityEvent = (event: string, details: any, level: string = 'warn') => {
  logger.log(level, 'Security event', {
    event,
    details,
    timestamp: new Date().toISOString(),
    severity: level
  });
};

// Business event logging
export const logBusinessEvent = (event: string, userId?: string, details?: any) => {
  logger.info('Business event', {
    event,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
};

export default logger;
