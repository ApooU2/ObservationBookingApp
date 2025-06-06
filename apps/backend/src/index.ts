import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import morgan from 'morgan';

// Import utilities
import logger, { logStream, logBusinessEvent } from './utils/logger';
import { startMetricsLogging, collectMetrics, getMetricsHandler } from './utils/metrics';
import { healthCheckHandler, detailedHealthHandler } from './utils/healthMonitor';

// Import middleware
import { 
  requestTracker, 
  securityMonitor, 
  createAdvancedRateLimit, 
  apiVersioning,
  validateContentType,
  healthCheck
} from './middleware/monitoring';

import authRoutes from './routes/auth';
import bookingRoutes from './routes/bookings';
import telescopeRoutes from './routes/telescopes';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';
import monitoringRoutes from './routes/monitoring';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import reminderService from './services/reminderService';

dotenv.config();

// Initialize logger
logger.info('Observatory Booking API starting up', {
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development'
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Enhanced rate limiting with different tiers
const generalLimiter = createAdvancedRateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const authLimiter = createAdvancedRateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const apiLimiter = createAdvancedRateLimit({ windowMs: 15 * 60 * 1000, max: 200 });

// Security and monitoring middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Logging middleware
app.use(morgan('combined', { stream: logStream }));

// Monitoring middleware
app.use(healthCheck);
app.use(collectMetrics);
app.use(securityMonitor);
app.use(apiVersioning);
app.use(validateContentType(['application/json', 'application/x-www-form-urlencoded']));

app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes with specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/bookings', apiLimiter, authenticateToken, bookingRoutes);
app.use('/api/telescopes', apiLimiter, telescopeRoutes);
app.use('/api/users', apiLimiter, authenticateToken, userRoutes);
app.use('/api/admin', apiLimiter, authenticateToken, adminRoutes);
app.use('/api/monitoring', apiLimiter, monitoringRoutes);

// Enhanced health check endpoints
app.get('/api/health', healthCheckHandler);
app.get('/api/health/detailed', detailedHealthHandler);

// Metrics endpoint (admin only in production, open in development)
if (process.env.NODE_ENV === 'production') {
  app.get('/api/metrics', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    getMetricsHandler(req, res);
  });
} else {
  app.get('/api/metrics', getMetricsHandler);
}

// Legacy health endpoint for compatibility
app.get('/api/auth/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memoryUsage: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version
  };
  
  res.status(200).json(healthCheck);
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed.');
    
    mongoose.connection.close().then(() => {
      logger.info('MongoDB connection closed.');
      process.exit(0);
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  gracefulShutdown('unhandledRejection');
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  logger.info('User connected', { socketId: socket.id });
  
  socket.on('join-booking-room', (telescopeId) => {
    socket.join(`telescope-${telescopeId}`);
    logger.info('User joined booking room', { 
      socketId: socket.id, 
      telescopeId 
    });
  });
  
  socket.on('disconnect', () => {
    logger.info('User disconnected', { socketId: socket.id });
  });
});

// Make io available to routes
app.set('io', io);

// Error handling
app.use(errorHandler);

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/observatory-booking';
    await mongoose.connect(mongoURI);
    logger.info('MongoDB connected successfully', { mongoURI: mongoURI.replace(/\/\/[^@]+@/, '//***@') });
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 30001;

connectDB().then(() => {
  // Start metrics logging
  startMetricsLogging();
  logger.info('Metrics logging started');
  
  // Start reminder service
  reminderService.startReminderScheduler();
  logger.info('Reminder service started');
  
  // Log business event
  logBusinessEvent('application_startup', undefined, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
  
  server.listen(PORT, () => {
    logger.info(`Observatory Booking API server started`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    });
  });
});

export { io };
