import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Input sanitization options
 */
interface SanitizationOptions {
  stripHtml?: boolean;
  trimWhitespace?: boolean;
  escapeHtml?: boolean;
  maxLength?: number;
}

/**
 * Sanitize a string value
 */
function sanitizeString(value: string, options: SanitizationOptions = {}): string {
  let sanitized = value;

  // Trim whitespace
  if (options.trimWhitespace !== false) {
    sanitized = sanitized.trim();
  }

  // Strip HTML tags
  if (options.stripHtml) {
    sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
  }

  // Escape HTML entities
  if (options.escapeHtml) {
    sanitized = validator.escape(sanitized);
  }

  // Enforce max length
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any, options: SanitizationOptions = {}): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key], options);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Middleware to sanitize request body
 */
export function sanitizeBody(options: SanitizationOptions = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body) {
      req.body = sanitizeObject(req.body, {
        trimWhitespace: true,
        escapeHtml: true,
        ...options
      });
    }
    next();
  };
}

/**
 * Middleware to sanitize query parameters
 */
export function sanitizeQuery(options: SanitizationOptions = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.query) {
      req.query = sanitizeObject(req.query, {
        trimWhitespace: true,
        escapeHtml: true,
        ...options
      });
    }
    next();
  };
}

/**
 * Middleware to sanitize route parameters
 */
export function sanitizeParams(options: SanitizationOptions = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.params) {
      req.params = sanitizeObject(req.params, {
        trimWhitespace: true,
        escapeHtml: true,
        ...options
      });
    }
    next();
  };
}

/**
 * Validate common input patterns
 */
export const inputValidators = {
  /**
   * Validate UUID format
   */
  isUUID: (value: string): boolean => {
    return validator.isUUID(value);
  },

  /**
   * Validate email format
   */
  isEmail: (value: string): boolean => {
    return validator.isEmail(value);
  },

  /**
   * Validate URL format
   */
  isURL: (value: string): boolean => {
    return validator.isURL(value, {
      protocols: ['http', 'https'],
      require_protocol: true
    });
  },

  /**
   * Validate alphanumeric string
   */
  isAlphanumeric: (value: string): boolean => {
    return validator.isAlphanumeric(value);
  },

  /**
   * Validate numeric string
   */
  isNumeric: (value: string): boolean => {
    return validator.isNumeric(value);
  },

  /**
   * Validate date format
   */
  isDate: (value: string): boolean => {
    return validator.isISO8601(value);
  },

  /**
   * Validate integer
   */
  isInt: (value: string, options?: validator.IsIntOptions): boolean => {
    return validator.isInt(value, options);
  },

  /**
   * Validate float
   */
  isFloat: (value: string, options?: validator.IsFloatOptions): boolean => {
    return validator.isFloat(value, options);
  },

  /**
   * Validate length
   */
  isLength: (value: string, options: validator.IsLengthOptions): boolean => {
    return validator.isLength(value, options);
  }
};

/**
 * Middleware to validate UUID parameter
 */
export function validateUUIDParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    
    if (!value) {
      throw new ValidationError(`Parameter '${paramName}' is required`);
    }

    if (!inputValidators.isUUID(value)) {
      throw new ValidationError(`Parameter '${paramName}' must be a valid UUID`);
    }

    next();
  };
}

/**
 * Middleware to validate required body fields
 */
export function validateRequiredFields(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const missing: string[] = [];

    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required fields: ${missing.join(', ')}`,
        missing.map(field => ({ field, message: 'This field is required' }))
      );
    }

    next();
  };
}

/**
 * Middleware to validate email field
 */
export function validateEmailField(fieldName: string = 'email') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const email = req.body[fieldName];

    if (email && !inputValidators.isEmail(email)) {
      throw new ValidationError(
        `Invalid email format`,
        [{ field: fieldName, message: 'Must be a valid email address' }]
      );
    }

    next();
  };
}

/**
 * Middleware to validate pagination parameters
 */
export function validatePagination() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { page, limit } = req.query;

    if (page !== undefined) {
      const pageNum = parseInt(page as string, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        throw new ValidationError('Page must be a positive integer');
      }
      req.query.page = pageNum.toString();
    }

    if (limit !== undefined) {
      const limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
      }
      req.query.limit = limitNum.toString();
    }

    next();
  };
}

/**
 * Middleware to validate date range parameters
 */
export function validateDateRange() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { startDate, endDate } = req.query;

    if (startDate && !inputValidators.isDate(startDate as string)) {
      throw new ValidationError('startDate must be a valid ISO 8601 date');
    }

    if (endDate && !inputValidators.isDate(endDate as string)) {
      throw new ValidationError('endDate must be a valid ISO 8601 date');
    }

    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (start > end) {
        throw new ValidationError('startDate must be before endDate');
      }
    }

    next();
  };
}

/**
 * Middleware to prevent SQL injection in sort parameters
 */
export function validateSortParam(allowedFields: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { sortBy, sortOrder } = req.query;

    if (sortBy) {
      const field = (sortBy as string).toLowerCase();
      if (!allowedFields.includes(field)) {
        throw new ValidationError(
          `Invalid sort field. Allowed fields: ${allowedFields.join(', ')}`
        );
      }
    }

    if (sortOrder) {
      const order = (sortOrder as string).toUpperCase();
      if (order !== 'ASC' && order !== 'DESC') {
        throw new ValidationError('sortOrder must be ASC or DESC');
      }
    }

    next();
  };
}

/**
 * Middleware to validate file upload
 */
export function validateFileUpload(options: {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.file && !req.files) {
      throw new ValidationError('No file uploaded');
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file];

    for (const file of files) {
      if (!file) continue;

      // Check file size
      if (options.maxSize && file.size > options.maxSize) {
        throw new ValidationError(
          `File size exceeds maximum allowed size of ${options.maxSize} bytes`
        );
      }

      // Check MIME type
      if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
        throw new ValidationError(
          `File type ${file.mimetype} is not allowed. Allowed types: ${options.allowedMimeTypes.join(', ')}`
        );
      }

      // Check file extension
      if (options.allowedExtensions) {
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        if (!ext || !options.allowedExtensions.includes(ext)) {
          throw new ValidationError(
            `File extension .${ext} is not allowed. Allowed extensions: ${options.allowedExtensions.join(', ')}`
          );
        }
      }
    }

    next();
  };
}
