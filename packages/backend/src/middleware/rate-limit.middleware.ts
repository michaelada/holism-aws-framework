import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Rate limit store interface
 */
interface RateLimitStore {
  increment(key: string): Promise<number>;
  reset(key: string): Promise<void>;
  get(key: string): Promise<number>;
}

/**
 * In-memory rate limit store
 * For production, consider using Redis
 */
class MemoryStore implements RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async increment(key: string): Promise<number> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      this.store.set(key, {
        count: 1,
        resetTime: now + 60000 // 1 minute window
      });
      return 1;
    }

    entry.count++;
    return entry.count;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async get(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || entry.resetTime < Date.now()) {
      return 0;
    }
    return entry.count;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Maximum number of requests per window
  message?: string; // Error message
  statusCode?: number; // HTTP status code for rate limit exceeded
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  handler?: (req: Request, res: Response) => void; // Custom handler
  store?: RateLimitStore; // Custom store
}

/**
 * Default rate limit configuration
 */
const defaultConfig: Required<Omit<RateLimitConfig, 'handler' | 'store'>> = {
  windowMs: 60000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please try again later',
  statusCode: 429,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req: Request) => {
    // Use IP address as default key
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
};

/**
 * Create rate limit middleware
 */
export function rateLimit(config: RateLimitConfig = {}) {
  const options = { ...defaultConfig, ...config };
  const store = config.store || new MemoryStore();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = options.keyGenerator(req);
      const count = await store.increment(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', options.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + options.windowMs).toISOString());

      if (count > options.max) {
        logger.warn('Rate limit exceeded', {
          key,
          count,
          max: options.max,
          path: req.path,
          method: req.method
        });

        if (options.handler) {
          return options.handler(req, res);
        }

        return res.status(options.statusCode).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: options.message
          }
        });
      }

      // Track response to potentially skip counting
      const originalSend = res.send;
      res.send = function (data: any) {
        const shouldSkip =
          (options.skipSuccessfulRequests && res.statusCode < 400) ||
          (options.skipFailedRequests && res.statusCode >= 400);

        if (shouldSkip) {
          store.reset(key).catch(err => {
            logger.error('Failed to reset rate limit', { key, error: err });
          });
        }

        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Rate limit middleware error', { error });
      // Don't block request on rate limit errors
      next();
    }
  };
}

/**
 * Strict rate limit for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true // Only count failed attempts
});

/**
 * Standard rate limit for API endpoints
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please try again later'
});

/**
 * Strict rate limit for file upload endpoints
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: 'Too many file uploads, please try again later'
});

/**
 * Rate limit for expensive operations (reports, exports)
 */
export const expensiveOperationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many export requests, please try again later'
});

/**
 * Per-user rate limit (requires authentication)
 */
export function perUserRateLimit(config: RateLimitConfig = {}) {
  return rateLimit({
    ...config,
    keyGenerator: (req: Request) => {
      // Use user ID if available, otherwise fall back to IP
      const user = (req as any).user;
      return user?.id || req.ip || 'unknown';
    }
  });
}

/**
 * Per-organization rate limit (requires authentication)
 */
export function perOrganizationRateLimit(config: RateLimitConfig = {}) {
  return rateLimit({
    ...config,
    keyGenerator: (req: Request) => {
      // Use organization ID if available, otherwise fall back to IP
      const user = (req as any).user;
      return user?.organisationId || req.ip || 'unknown';
    }
  });
}
