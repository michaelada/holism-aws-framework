import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ForbiddenError } from './errors';
import { logger } from '../config/logger';

/**
 * CSRF token store interface
 */
interface CSRFTokenStore {
  set(sessionId: string, token: string): Promise<void>;
  get(sessionId: string): Promise<string | null>;
  delete(sessionId: string): Promise<void>;
}

/**
 * In-memory CSRF token store
 * For production, consider using Redis with session management
 */
class MemoryCSRFStore implements CSRFTokenStore {
  private store: Map<string, { token: string; expiresAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired tokens every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async set(sessionId: string, token: string): Promise<void> {
    // Tokens expire after 1 hour
    const expiresAt = Date.now() + 60 * 60 * 1000;
    this.store.set(sessionId, { token, expiresAt });
  }

  async get(sessionId: string): Promise<string | null> {
    const entry = this.store.get(sessionId);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.store.delete(sessionId);
      return null;
    }

    return entry.token;
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [sessionId, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        this.store.delete(sessionId);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * CSRF protection configuration
 */
export interface CSRFConfig {
  tokenLength?: number; // Length of CSRF token in bytes
  headerName?: string; // Header name for CSRF token
  cookieName?: string; // Cookie name for CSRF token
  ignoreMethods?: string[]; // HTTP methods to ignore (e.g., GET, HEAD, OPTIONS)
  store?: CSRFTokenStore; // Custom token store
}

/**
 * Default CSRF configuration
 */
const defaultConfig: Required<Omit<CSRFConfig, 'store'>> = {
  tokenLength: 32,
  headerName: 'x-csrf-token',
  cookieName: 'csrf-token',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
};

/**
 * Generate a random CSRF token
 */
function generateToken(length: number): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Get session ID from request
 * Uses user ID if authenticated, otherwise uses IP address
 */
function getSessionId(req: Request): string {
  const user = (req as any).user;
  if (user?.id) {
    return `user:${user.id}`;
  }
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

/**
 * Create CSRF protection middleware
 */
export function csrfProtection(config: CSRFConfig = {}) {
  const options = { ...defaultConfig, ...config };
  const store = config.store || new MemoryCSRFStore();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getSessionId(req);

      // Skip CSRF check for safe methods
      if (options.ignoreMethods.includes(req.method)) {
        // Generate and send token for safe methods
        let token = await store.get(sessionId);
        if (!token) {
          token = generateToken(options.tokenLength);
          await store.set(sessionId, token);
        }

        // Set token in cookie and header
        res.cookie(options.cookieName, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 1000 // 1 hour
        });
        res.setHeader(options.headerName, token);

        return next();
      }

      // For unsafe methods, verify CSRF token
      const tokenFromHeader = req.headers[options.headerName] as string;
      const tokenFromBody = req.body?._csrf;

      const providedToken = tokenFromHeader || tokenFromBody;

      if (!providedToken) {
        logger.warn('CSRF token missing', {
          method: req.method,
          path: req.path,
          sessionId
        });
        throw new ForbiddenError('CSRF token missing');
      }

      const storedToken = await store.get(sessionId);

      if (!storedToken) {
        logger.warn('CSRF token not found in store', {
          method: req.method,
          path: req.path,
          sessionId
        });
        throw new ForbiddenError('CSRF token invalid or expired');
      }

      // Use timing-safe comparison
      const providedBuffer = Buffer.from(providedToken);
      const storedBuffer = Buffer.from(storedToken);

      if (providedBuffer.length !== storedBuffer.length) {
        logger.warn('CSRF token length mismatch', {
          method: req.method,
          path: req.path,
          sessionId
        });
        throw new ForbiddenError('CSRF token invalid');
      }

      if (!crypto.timingSafeEqual(providedBuffer, storedBuffer)) {
        logger.warn('CSRF token mismatch', {
          method: req.method,
          path: req.path,
          sessionId
        });
        throw new ForbiddenError('CSRF token invalid');
      }

      // Token is valid, regenerate for next request
      const newToken = generateToken(options.tokenLength);
      await store.set(sessionId, newToken);

      res.cookie(options.cookieName, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000
      });
      res.setHeader(options.headerName, newToken);

      next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        next(error);
      } else {
        logger.error('CSRF middleware error', { error });
        next(new ForbiddenError('CSRF validation failed'));
      }
    }
  };
}

/**
 * Middleware to generate CSRF token for forms
 * Use this on routes that render forms
 */
export function generateCSRFToken(config: CSRFConfig = {}) {
  const options = { ...defaultConfig, ...config };
  const store = config.store || new MemoryCSRFStore();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getSessionId(req);
      let token = await store.get(sessionId);

      if (!token) {
        token = generateToken(options.tokenLength);
        await store.set(sessionId, token);
      }

      // Make token available to templates
      (req as any).csrfToken = token;

      // Set in cookie and header
      res.cookie(options.cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000
      });
      res.setHeader(options.headerName, token);

      next();
    } catch (error) {
      logger.error('CSRF token generation error', { error });
      next(error);
    }
  };
}

/**
 * Double Submit Cookie pattern for CSRF protection
 * Simpler alternative that doesn't require server-side storage
 */
export function doubleSubmitCookie(config: Omit<CSRFConfig, 'store'> = {}) {
  const options = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip CSRF check for safe methods
      if (options.ignoreMethods.includes(req.method)) {
        // Generate and send token
        const token = generateToken(options.tokenLength);
        res.cookie(options.cookieName, token, {
          httpOnly: false, // Must be readable by JavaScript
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 1000
        });
        res.setHeader(options.headerName, token);
        return next();
      }

      // For unsafe methods, verify token matches cookie
      const tokenFromHeader = req.headers[options.headerName] as string;
      const tokenFromCookie = req.cookies?.[options.cookieName];

      if (!tokenFromHeader || !tokenFromCookie) {
        logger.warn('CSRF double submit cookie missing', {
          method: req.method,
          path: req.path,
          hasHeader: !!tokenFromHeader,
          hasCookie: !!tokenFromCookie
        });
        throw new ForbiddenError('CSRF token missing');
      }

      // Use timing-safe comparison
      const headerBuffer = Buffer.from(tokenFromHeader);
      const cookieBuffer = Buffer.from(tokenFromCookie);

      if (headerBuffer.length !== cookieBuffer.length) {
        logger.warn('CSRF double submit cookie length mismatch', {
          method: req.method,
          path: req.path
        });
        throw new ForbiddenError('CSRF token invalid');
      }

      if (!crypto.timingSafeEqual(headerBuffer, cookieBuffer)) {
        logger.warn('CSRF double submit cookie mismatch', {
          method: req.method,
          path: req.path
        });
        throw new ForbiddenError('CSRF token invalid');
      }

      next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        next(error);
      } else {
        logger.error('CSRF double submit cookie error', { error });
        next(new ForbiddenError('CSRF validation failed'));
      }
    }
  };
}
