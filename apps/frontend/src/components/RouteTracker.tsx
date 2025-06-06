import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import monitoring from '../utils/monitoring';

/**
 * RouteTracker - Monitors route changes and reports them to the monitoring service
 * Place this component inside your Router but outside of your Routes
 */
const RouteTracker: React.FC = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Track page view on initial load and route changes
    const path = location.pathname + location.search;
    const title = document.title || path;
    
    monitoring.trackPageView(path, title);
    
    // Also track page load performance
    const navigationStart = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationStart) {
      const pageLoadTime = navigationStart.loadEventEnd - navigationStart.startTime;
      monitoring.trackPerformance('page_load_complete', pageLoadTime);
      
      // Track more detailed metrics
      const dnsTime = navigationStart.domainLookupEnd - navigationStart.domainLookupStart;
      const connectionTime = navigationStart.connectEnd - navigationStart.connectStart;
      const responseTime = navigationStart.responseEnd - navigationStart.responseStart;
      const domProcessingTime = navigationStart.domComplete - navigationStart.domInteractive;
      
      monitoring.trackPerformance('dns_lookup', dnsTime);
      monitoring.trackPerformance('connection', connectionTime);
      monitoring.trackPerformance('server_response', responseTime);
      monitoring.trackPerformance('dom_processing', domProcessingTime);
    }
  }, [location]);
  
  return null; // This component doesn't render anything
};

export default RouteTracker;
