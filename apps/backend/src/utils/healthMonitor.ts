import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as os from 'os';
import logger from './logger';
import { metricsCollector } from './metrics';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    memory: ServiceHealth;
    disk: ServiceHealth;
    api: ServiceHealth;
  };
  metrics: {
    requestCount: number;
    errorRate: number;
    averageResponseTime: number;
    activeConnections: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: any;
}

class HealthMonitor {
  private startTime = Date.now();

  async checkDatabase(): Promise<ServiceHealth> {
    try {
      const state = mongoose.connection.readyState;
      
      if (state === 1) {
        // Test with a simple query
        if (mongoose.connection.db) {
          await mongoose.connection.db.admin().ping();
        }
        return {
          status: 'healthy',
          message: 'Database connection is healthy',
          details: { state: 'connected' }
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'Database not connected',
          details: { state }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  checkMemory(): ServiceHealth {
    const usage = process.memoryUsage();
    const threshold = 1024 * 1024 * 1024; // 1GB

    if (usage.heapUsed < threshold * 0.7) {
      return {
        status: 'healthy',
        message: 'Memory usage is normal',
        details: usage
      };
    } else if (usage.heapUsed < threshold) {
      return {
        status: 'degraded',
        message: 'Memory usage is elevated',
        details: usage
      };
    } else {
      return {
        status: 'unhealthy',
        message: 'Memory usage is critical',
        details: usage
      };
    }
  }

  checkDisk(): ServiceHealth {
    try {
      const fs = require('fs');
      const stats = fs.statSync(process.cwd());
      
      return {
        status: 'healthy',
        message: 'Disk access is healthy',
        details: { accessible: true }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Disk access failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  checkAPI(): ServiceHealth {
    const metrics = metricsCollector.getMetrics();
    
    if (metrics.errorRate < 5 && metrics.averageResponseTime < 1000) {
      return {
        status: 'healthy',
        message: 'API performance is healthy',
        details: metrics
      };
    } else if (metrics.errorRate < 15 && metrics.averageResponseTime < 3000) {
      return {
        status: 'degraded',
        message: 'API performance is degraded',
        details: metrics
      };
    } else {
      return {
        status: 'unhealthy',
        message: 'API performance is poor',
        details: metrics
      };
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const database = await this.checkDatabase();
    const memory = this.checkMemory();
    const disk = this.checkDisk();
    const api = this.checkAPI();
    const metrics = metricsCollector.getMetrics();

    const services = { database, memory, disk, api };
    const serviceStatuses = Object.values(services).map(s => s.status);
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (serviceStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      services,
      metrics: {
        requestCount: metrics.requestCount,
        errorRate: metrics.errorRate,
        averageResponseTime: metrics.averageResponseTime,
        activeConnections: metrics.activeConnections
      }
    };
  }
}

const healthMonitor = new HealthMonitor();

// Health check endpoint handler
export const healthCheckHandler = async (req: Request, res: Response) => {
  try {
    const health = await healthMonitor.getHealthStatus();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
    
    // Log health check results
    if (health.status !== 'healthy') {
      logger.warn('Health check warning', { health });
    }
    
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({
      status: 'unhealthy',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Detailed health check with more information
export const detailedHealthHandler = async (req: Request, res: Response) => {
  try {
    const health = await healthMonitor.getHealthStatus();
    
    // Add more detailed system information
    const detailedHealth = {
      ...health,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        loadAverage: os.loadavg(),
        environment: process.env.NODE_ENV
      }
    };
    
    res.json(detailedHealth);
    
  } catch (error) {
    logger.error('Detailed health check failed', { error });
    res.status(500).json({
      status: 'unhealthy',
      message: 'Detailed health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

export { healthMonitor };
