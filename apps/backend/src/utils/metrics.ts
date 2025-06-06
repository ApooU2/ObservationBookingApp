import { Request, Response, NextFunction } from 'express';
import * as os from 'os';
import logger from './logger';

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}

class MetricsCollector {
  private requestCount = 0;
  private totalResponseTime = 0;
  private errorCount = 0;
  private activeConnections = 0;
  private startTime = Date.now();

  incrementRequest() {
    this.requestCount++;
  }

  addResponseTime(time: number) {
    this.totalResponseTime += time;
  }

  incrementError() {
    this.errorCount++;
  }

  incrementConnection() {
    this.activeConnections++;
  }

  decrementConnection() {
    this.activeConnections--;
  }

  getMetrics(): PerformanceMetrics {
    return {
      requestCount: this.requestCount,
      averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      activeConnections: this.activeConnections,
      memoryUsage: process.memoryUsage(),
      uptime: Date.now() - this.startTime
    };
  }

  reset() {
    this.requestCount = 0;
    this.totalResponseTime = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }
}

const metricsCollector = new MetricsCollector();

// Middleware to collect metrics
export const collectMetrics = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  metricsCollector.incrementRequest();
  metricsCollector.incrementConnection();

  // Cleanup on response finish
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    metricsCollector.addResponseTime(responseTime);
    metricsCollector.decrementConnection();

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        url: req.url,
        method: req.method,
        responseTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }

    // Track errors
    if (res.statusCode >= 400) {
      metricsCollector.incrementError();
    }
  });

  next();
};

// Get metrics endpoint handler
export const getMetricsHandler = (req: Request, res: Response) => {
  const metrics = metricsCollector.getMetrics();
  
  // Add additional system metrics
  const systemMetrics = {
    ...metrics,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    loadAverage: os.loadavg(),
    freeMemory: os.freemem(),
    totalMemory: process.memoryUsage().heapTotal
  };

  res.json(systemMetrics);
};

// Performance monitoring and alerting
export const startMetricsLogging = () => {
  setInterval(() => {
    const metrics = metricsCollector.getMetrics();
    
    logger.info('System metrics', metrics);

    // Alert on high error rate
    if (metrics.errorRate > 10) {
      logger.error('High error rate detected', {
        errorRate: metrics.errorRate,
        requestCount: metrics.requestCount
      });
    }

    // Alert on high memory usage
    if (metrics.memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      logger.warn('High memory usage detected', {
        memoryUsage: metrics.memoryUsage
      });
    }

    // Alert on slow average response time
    if (metrics.averageResponseTime > 2000) {
      logger.warn('Slow average response time detected', {
        averageResponseTime: metrics.averageResponseTime
      });
    }

  }, 60000); // Log every minute
};

export { metricsCollector };
