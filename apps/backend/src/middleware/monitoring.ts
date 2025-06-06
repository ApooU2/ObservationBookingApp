import { Request, Response, NextFunction } from 'express';
import logger, { logPerformance, logSecurityEvent } from '../utils/logger';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

// Request tracking middleware
export const requestTracker = (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Add request ID to request object
  (req as any).requestId = requestId;
  
  // Log request start
  logger.http('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Response logging
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    logger.http('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    // Log performance metrics
    logPerformance('request', startTime, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      ip: req.ip
    });
  });

  next();
};

// Security monitoring middleware
export const securityMonitor = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\.\.|\.\.\/|\.\.\\)/,  // Path traversal
    /<script/i,              // XSS attempts
    /union.*select/i,        // SQL injection
    /javascript:/i,          // JavaScript injection
    /vbscript:/i            // VBScript injection
  ];

  const userAgent = req.get('User-Agent') || '';
  const url = req.url;
  const body = JSON.stringify(req.body);

  // Check for suspicious patterns
  const suspicious = suspiciousPatterns.some(pattern => 
    pattern.test(url) || pattern.test(body) || pattern.test(userAgent)
  );

  if (suspicious) {
    logSecurityEvent('suspicious_request', {
      ip: req.ip,
      userAgent,
      url,
      method: req.method,
      body: req.body
    }, 'warn');
  }

  // Monitor for brute force attempts
  if (req.url.includes('/login') && req.method === 'POST') {
    logSecurityEvent('login_attempt', {
      ip: req.ip,
      userAgent,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Enhanced rate limiting with different tiers
export const createAdvancedRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests from this IP',
    keyGenerator: options.keyGenerator || ((req) => req.ip || 'unknown'),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logSecurityEvent('rate_limit_exceeded', {
        ip: req.ip,
        url: req.url,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
};

// API versioning middleware
export const apiVersioning = (req: Request, res: Response, next: NextFunction) => {
  const version = req.headers['api-version'] || req.query.version || 'v1';
  (req as any).apiVersion = version;
  
  // Log API version usage
  logger.info('API version used', {
    version,
    url: req.url,
    ip: req.ip
  });

  next();
};

// Content type validation
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.get('Content-Type');
      
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        logSecurityEvent('invalid_content_type', {
          contentType,
          url: req.url,
          ip: req.ip
        });
        
        return res.status(415).json({
          error: 'Unsupported Media Type',
          allowedTypes
        });
      }
    }
    
    next();
  };
};

// Health check middleware
export const healthCheck = (req: Request, res: Response, next: NextFunction) => {
  if (req.url === '/api/health' || req.url === '/api/auth/health') {
    // Don't log health check requests in detail
    return next();
  }
  
  return requestTracker(req, res, next);
};
