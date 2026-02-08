import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from './logger';

// Create a Registry to register the metrics
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  register,
  prefix: 'aws_framework_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP Request metrics
export const httpRequestDuration = new Histogram({
  name: 'aws_framework_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'aws_framework_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestErrors = new Counter({
  name: 'aws_framework_http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [register],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'aws_framework_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const dbQueryTotal = new Counter({
  name: 'aws_framework_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

export const dbConnectionPoolSize = new Gauge({
  name: 'aws_framework_db_connection_pool_size',
  help: 'Current size of database connection pool',
  labelNames: ['state'],
  registers: [register],
});

export const dbQueryErrors = new Counter({
  name: 'aws_framework_db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['operation', 'table', 'error_type'],
  registers: [register],
});

// Business logic metrics
export const metadataOperations = new Counter({
  name: 'aws_framework_metadata_operations_total',
  help: 'Total number of metadata operations',
  labelNames: ['operation', 'entity_type', 'status'],
  registers: [register],
});

export const instanceOperations = new Counter({
  name: 'aws_framework_instance_operations_total',
  help: 'Total number of instance CRUD operations',
  labelNames: ['operation', 'object_type', 'status'],
  registers: [register],
});

export const validationErrors = new Counter({
  name: 'aws_framework_validation_errors_total',
  help: 'Total number of validation errors',
  labelNames: ['entity_type', 'validation_type'],
  registers: [register],
});

export const dynamicTableOperations = new Counter({
  name: 'aws_framework_dynamic_table_operations_total',
  help: 'Total number of dynamic table operations',
  labelNames: ['operation', 'object_type', 'status'],
  registers: [register],
});

// Authentication metrics
export const authAttempts = new Counter({
  name: 'aws_framework_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status'],
  registers: [register],
});

export const authTokenValidations = new Counter({
  name: 'aws_framework_auth_token_validations_total',
  help: 'Total number of token validations',
  labelNames: ['status'],
  registers: [register],
});

// Active connections gauge
export const activeConnections = new Gauge({
  name: 'aws_framework_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

logger.info('Prometheus metrics initialized');
