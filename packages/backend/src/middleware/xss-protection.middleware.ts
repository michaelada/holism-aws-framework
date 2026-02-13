import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { logger } from '../config/logger';

/**
 * XSS protection configuration
 */
export interface XSSConfig {
  allowedTags?: string[]; // HTML tags to allow
  allowedAttributes?: Record<string, string[]>; // Allowed attributes per tag
  stripIgnoreTag?: boolean; // Strip tags not in allowedTags
  stripIgnoreTagBody?: string[]; // Strip content of these tags
}

/**
 * Default XSS configuration - very restrictive
 */
const defaultConfig: XSSConfig = {
  allowedTags: [], // No HTML tags allowed by default
  allowedAttributes: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style']
};

/**
 * Configuration for rich text fields (e.g., descriptions, terms & conditions)
 */
export const richTextConfig: XSSConfig = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div'
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target'],
    'span': ['class'],
    'div': ['class']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
};

/**
 * Sanitize HTML content using DOMPurify
 */
function sanitizeHTML(html: string, config: XSSConfig): string {
  const purifyConfig: any = {
    ALLOWED_TAGS: config.allowedTags || [],
    ALLOWED_ATTR: Object.keys(config.allowedAttributes || {}),
    KEEP_CONTENT: !config.stripIgnoreTag
  };

  if (config.stripIgnoreTagBody && config.stripIgnoreTagBody.length > 0) {
    purifyConfig.FORBID_TAGS = config.stripIgnoreTagBody;
    purifyConfig.FORBID_CONTENTS = config.stripIgnoreTagBody;
  }

  return DOMPurify.sanitize(html, purifyConfig) as unknown as string;
}

/**
 * Recursively sanitize HTML in object
 */
function sanitizeObjectHTML(obj: any, config: XSSConfig, fieldsToSanitize?: string[]): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Only sanitize if it looks like HTML or if no specific fields specified
    if (!fieldsToSanitize || obj.includes('<') || obj.includes('>')) {
      return sanitizeHTML(obj, config);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectHTML(item, config, fieldsToSanitize));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Check if this field should be sanitized
        if (!fieldsToSanitize || fieldsToSanitize.includes(key)) {
          sanitized[key] = sanitizeObjectHTML(obj[key], config, fieldsToSanitize);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Middleware to protect against XSS attacks
 * Sanitizes HTML content in request body
 */
export function xssProtection(config: XSSConfig = defaultConfig, fieldsToSanitize?: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.body) {
        const originalBody = JSON.stringify(req.body);
        req.body = sanitizeObjectHTML(req.body, config, fieldsToSanitize);
        const sanitizedBody = JSON.stringify(req.body);

        // Log if content was modified
        if (originalBody !== sanitizedBody) {
          logger.warn('XSS protection: Content sanitized', {
            path: req.path,
            method: req.method,
            fieldsModified: fieldsToSanitize || 'all'
          });
        }
      }

      next();
    } catch (error) {
      logger.error('XSS protection middleware error', { error });
      // Don't block request on XSS protection errors
      next();
    }
  };
}

/**
 * Middleware for rich text fields
 * Allows common formatting tags but strips dangerous content
 */
export function richTextXSSProtection(fieldsToSanitize?: string[]) {
  return xssProtection(richTextConfig, fieldsToSanitize);
}

/**
 * Middleware for strict XSS protection
 * Strips all HTML tags
 */
export function strictXSSProtection(fieldsToSanitize?: string[]) {
  return xssProtection(defaultConfig, fieldsToSanitize);
}

/**
 * Set security headers for XSS protection
 */
export function xssSecurityHeaders() {
  return (_req: Request, res: Response, next: NextFunction) => {
    // X-XSS-Protection header (legacy, but still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // X-Content-Type-Options header
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options header
    res.setHeader('X-Frame-Options', 'DENY');

    // Referrer-Policy header
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy header
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  };
}

/**
 * Detect potential XSS attempts in input
 */
export function detectXSS(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<applet/gi,
    /eval\(/gi,
    /expression\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Middleware to detect and log XSS attempts
 */
export function xssDetection() {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const checkForXSS = (obj: any, path: string = ''): void => {
        if (typeof obj === 'string') {
          if (detectXSS(obj)) {
            logger.warn('Potential XSS attempt detected', {
              path: req.path,
              method: req.method,
              field: path,
              ip: req.ip,
              userAgent: req.headers['user-agent']
            });
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item, index) => checkForXSS(item, `${path}[${index}]`));
        } else if (typeof obj === 'object' && obj !== null) {
          Object.keys(obj).forEach(key => checkForXSS(obj[key], path ? `${path}.${key}` : key));
        }
      };

      if (req.body) {
        checkForXSS(req.body);
      }

      if (req.query) {
        checkForXSS(req.query);
      }

      next();
    } catch (error) {
      logger.error('XSS detection middleware error', { error });
      next();
    }
  };
}
