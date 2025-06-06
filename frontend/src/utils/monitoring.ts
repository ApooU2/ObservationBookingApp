/**
 * Frontend monitoring and error tracking utility
 * Provides client-side performance monitoring, error tracking, and user session analysis
 */

interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  timestamp: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
  component?: string;
  severity: 'error' | 'warning' | 'info';
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: string;
  userId?: string;
  sessionId: string;
  url: string;
}

class MonitoringService {
  private sessionId: string;
  private apiEndpoint: string;
  private isEnabled: boolean;
  private userId?: string;
  private samplingRate: number; // Between 0 and 1

  constructor() {
    this.sessionId = this.generateSessionId();
    this.apiEndpoint = process.env.REACT_APP_API_URL || 'http://localhost:30001';
    this.isEnabled = process.env.REACT_APP_ENABLE_MONITORING === 'true';
    this.samplingRate = parseFloat(process.env.REACT_APP_MONITORING_SAMPLING_RATE || '0.1'); // Default 10% sampling
    this.setupErrorListeners();
    this.setupPerformanceMonitoring();
  }

  /**
   * Initialize the monitoring service with user information
   */
  public init(userId?: string): void {
    this.userId = userId;
    this.reportEvent('session_start', { referrer: document.referrer });
    
    // Report basic client info
    this.reportEvent('client_info', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      connection: this.getConnectionInfo()
    });
  }

  /**
   * Track a handled error
   */
  public trackError(error: Error, component?: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      component,
      severity: 'error',
      metadata
    };

    this.sendToServer('/api/monitoring/errors', errorReport);
    console.error('[Monitoring]', errorReport.message, errorReport);
  }

  /**
   * Track a custom event
   */
  public trackEvent(name: string, data?: Record<string, any>): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    this.reportEvent(name, data);
  }

  /**
   * Track a page view
   */
  public trackPageView(path: string, title: string): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    this.reportEvent('page_view', {
      path,
      title,
      referrer: document.referrer
    });

    // Also track performance metrics for the page
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      
      // Wait for the page to fully load before calculating metrics
      window.addEventListener('load', () => {
        const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
        const domReadyTime = timing.domComplete - timing.domLoading;
        
        this.trackPerformance('page_load', pageLoadTime);
        this.trackPerformance('dom_ready', domReadyTime);
      });
    }
  }

  /**
   * Track performance metric
   */
  public trackPerformance(name: string, value: number): void {
    if (!this.isEnabled || !this.shouldSample()) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId,
      url: window.location.href
    };

    this.sendToServer('/api/monitoring/performance', metric);
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Set up global error listeners
   */
  private setupErrorListeners(): void {
    if (!this.isEnabled) return;

    // Global error handler
    window.addEventListener('error', (event: ErrorEvent) => {
      const errorReport: ErrorReport = {
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        userId: this.userId,
        sessionId: this.sessionId,
        severity: 'error'
      };

      this.sendToServer('/api/monitoring/errors', errorReport);
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const errorReport: ErrorReport = {
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        userId: this.userId,
        sessionId: this.sessionId,
        severity: 'error',
        metadata: { 
          type: 'unhandled_promise_rejection',
          reason: event.reason
        }
      };

      this.sendToServer('/api/monitoring/errors', errorReport);
    });
  }

  /**
   * Set up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (!this.isEnabled || !window.performance || !window.performance.memory) return;

    // Monitor memory usage periodically
    setInterval(() => {
      if (window.performance.memory) {
        const memoryInfo = window.performance.memory;
        
        this.trackPerformance('memory_used', memoryInfo.usedJSHeapSize);
        this.trackPerformance('memory_total', memoryInfo.totalJSHeapSize);
        
        // Alert if memory usage is high (over 90% of available)
        if (memoryInfo.usedJSHeapSize > memoryInfo.jsHeapSizeLimit * 0.9) {
          this.reportEvent('high_memory_usage', {
            used: memoryInfo.usedJSHeapSize,
            total: memoryInfo.totalJSHeapSize,
            limit: memoryInfo.jsHeapSizeLimit
          });
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Get connection information if available
   */
  private getConnectionInfo(): any {
    if (navigator.connection) {
      const conn = navigator.connection as any;
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      };
    }
    return null;
  }

  /**
   * Report event to the server
   */
  private reportEvent(name: string, data?: Record<string, any>): void {
    const event = {
      name,
      data,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId,
      url: window.location.href
    };

    this.sendToServer('/api/monitoring/events', event);
  }

  /**
   * Determine if this event should be sampled based on sampling rate
   */
  private shouldSample(): boolean {
    return Math.random() < this.samplingRate;
  }

  /**
   * Send data to the monitoring server
   */
  private sendToServer(endpoint: string, data: any): void {
    if (!this.isEnabled) return;

    // For development, log to console instead of sending to server
    if (process.env.NODE_ENV === 'development') {
      console.log('[Monitoring]', endpoint, data);
      return;
    }

    // Use sendBeacon if available (doesn't block page unload)
    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        navigator.sendBeacon(`${this.apiEndpoint}${endpoint}`, blob);
        return;
      } catch (e) {
        // Fall back to fetch if sendBeacon fails
        console.warn('SendBeacon failed, falling back to fetch', e);
      }
    }

    // Fall back to fetch with keepalive
    fetch(`${this.apiEndpoint}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
      mode: 'cors'
    }).catch(err => {
      console.error('Failed to send monitoring data', err);
    });
  }
}

// Create singleton instance
const monitoring = new MonitoringService();
export default monitoring;

// TypeScript extension for navigator.connection
declare global {
  interface Navigator {
    connection?: {
      effectiveType: string;
      downlink: number;
      rtt: number;
      saveData: boolean;
    };
  }

  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}
