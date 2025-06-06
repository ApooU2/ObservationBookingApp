/**
 * Client-side monitoring API endpoints
 * Receives and processes frontend monitoring data
 */

import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

/**
 * Process error reports from the frontend
 */
router.post('/errors', (req: Request, res: Response) => {
  const errorReport = req.body;
  
  // Log the error with appropriate level based on severity
  const logLevel = errorReport.severity || 'error';
  
  logger.log(logLevel, 'Frontend error', {
    message: errorReport.message,
    stack: errorReport.stack,
    url: errorReport.url,
    userAgent: errorReport.userAgent,
    userId: errorReport.userId,
    sessionId: errorReport.sessionId,
    component: errorReport.component,
    metadata: errorReport.metadata,
    timestamp: errorReport.timestamp || new Date().toISOString()
  });
  
  // Could store in database for persistent storage and analysis
  
  res.status(200).send({ status: 'ok' });
});

/**
 * Process performance metrics from the frontend
 */
router.post('/performance', (req: Request, res: Response) => {
  const metric = req.body;
  
  logger.info('Frontend performance metric', {
    name: metric.name,
    value: metric.value,
    url: metric.url,
    userId: metric.userId,
    sessionId: metric.sessionId,
    timestamp: metric.timestamp || new Date().toISOString()
  });
  
  // Could store in time-series database for trending and dashboards
  
  res.status(200).send({ status: 'ok' });
});

/**
 * Process user events from the frontend
 */
router.post('/events', (req: Request, res: Response) => {
  const event = req.body;
  
  logger.info('Frontend user event', {
    name: event.name,
    data: event.data,
    url: event.url,
    userId: event.userId,
    sessionId: event.sessionId,
    timestamp: event.timestamp || new Date().toISOString()
  });
  
  // Could store in database for user behavior analysis
  
  res.status(200).send({ status: 'ok' });
});

export default router;
