import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal, httpRequestErrors, activeConnections } from '../config/metrics';

/**
 * Middleware to track HTTP request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  // Increment active connections
  activeConnections.inc();
  
  // Track when response finishes
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = getRoutePattern(req.route?.path || req.path);
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    // Record request duration
    httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration
    );
    
    // Increment request counter
    httpRequestTotal.inc({ method, route, status_code: statusCode });
    
    // Track errors (4xx and 5xx)
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      httpRequestErrors.inc({ method, route, error_type: errorType });
    }
    
    // Decrement active connections
    activeConnections.dec();
  });
  
  next();
}

/**
 * Extract route pattern from request path
 * Converts /api/objects/customer/instances/123 to /api/objects/:objectType/instances/:id
 */
function getRoutePattern(path: string): string {
  // Replace UUIDs and numeric IDs with :id
  let pattern = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');
  pattern = pattern.replace(/\/\d+/g, '/:id');
  
  // Replace object type names with :objectType
  pattern = pattern.replace(/\/api\/objects\/[^\/]+\/instances/g, '/api/objects/:objectType/instances');
  
  // Replace field/object short names in metadata routes
  pattern = pattern.replace(/\/api\/metadata\/fields\/[^\/]+/g, '/api/metadata/fields/:shortName');
  pattern = pattern.replace(/\/api\/metadata\/objects\/[^\/]+/g, '/api/metadata/objects/:shortName');
  
  return pattern;
}
