import winston from 'winston';

/**
 * Log levels
 */
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Custom format for development
 */
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

/**
 * Custom format for production (JSON)
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Determine format based on environment
 */
const logFormat = process.env.NODE_ENV === 'production' ? prodFormat : devFormat;

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: {
    service: 'aws-web-framework-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

/**
 * Query performance threshold in milliseconds
 */
export const QUERY_PERFORMANCE_THRESHOLD = parseInt(
  process.env.QUERY_PERFORMANCE_THRESHOLD || '1000',
  10
);

/**
 * Log query performance
 * Logs queries that exceed the performance threshold with optimization suggestions
 */
export function logQueryPerformance(
  query: string,
  duration: number,
  params?: any[]
): void {
  if (duration >= QUERY_PERFORMANCE_THRESHOLD) {
    logger.warn('Slow query detected', {
      query,
      duration: `${duration}ms`,
      params,
      threshold: `${QUERY_PERFORMANCE_THRESHOLD}ms`,
      suggestion: 'Consider adding indexes or optimizing the query'
    });
  } else {
    logger.debug('Query executed', {
      query,
      duration: `${duration}ms`,
      params
    });
  }
}

/**
 * Log request details for observability
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string
): void {
  const logData = {
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
    userId
  };

  if (statusCode >= 500) {
    logger.error('Request failed with server error', logData);
  } else if (statusCode >= 400) {
    logger.warn('Request failed with client error', logData);
  } else {
    logger.info('Request completed', logData);
  }
}

/**
 * Sanitize sensitive data from logs
 * Removes passwords, tokens, and other sensitive fields
 */
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'cookie'
  ];

  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
}
