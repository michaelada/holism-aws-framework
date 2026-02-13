import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { db } from './database/pool';
import { logger } from './config/logger';
import { secretsManager } from './config/secrets';
import {
  errorHandler,
  requestLogger,
  metricsMiddleware,
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  apiRateLimit,
  xssSecurityHeaders,
  xssDetection
} from './middleware';
import metadataRoutes from './routes/metadata.routes';
import genericCrudRoutes from './routes/generic-crud.routes';
import adminRoutes from './routes/admin.routes';
import capabilityRoutes from './routes/capability.routes';
import organizationTypeRoutes from './routes/organization-type.routes';
import organizationRoutes from './routes/organization.routes';
import organizationUserRoutes from './routes/organization-user.routes';
import organizationRoleRoutes from './routes/organization-role.routes';
import eventRoutes from './routes/event.routes';
import membershipRoutes from './routes/membership.routes';
import merchandiseRoutes from './routes/merchandise.routes';
import calendarRoutes from './routes/calendar.routes';
import registrationRoutes from './routes/registration.routes';
import ticketingRoutes from './routes/ticketing.routes';
import applicationFormRoutes from './routes/application-form.routes';
import fileUploadRoutes from './routes/file-upload.routes';
import paymentRoutes from './routes/payment.routes';
import reportingRoutes from './routes/reporting.routes';
import userManagementRoutes from './routes/user-management.routes';
import { swaggerSpec } from './config/swagger';
import { register } from './config/metrics';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// XSS protection headers
app.use(xssSecurityHeaders());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Body parsing and cookie parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Input sanitization middleware
app.use(sanitizeBody());
app.use(sanitizeQuery());
app.use(sanitizeParams());

// XSS detection (logs potential attacks)
app.use(xssDetection());

// Rate limiting middleware
app.use('/api', apiRateLimit);

// Logging and metrics
app.use(metricsMiddleware);
app.use(requestLogger);

// API Documentation
/**
 * @swagger
 * tags:
 *   - name: System
 *     description: System health and status endpoints
 *   - name: Metadata - Fields
 *     description: Field definition management
 *   - name: Metadata - Objects
 *     description: Object definition management
 *   - name: Generic CRUD
 *     description: Generic CRUD operations for any registered object type
 */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AWS Web Framework API Documentation'
}));

// Health check endpoint
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check the health status of the API and database connection
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 database:
 *                   type: string
 *                   example: "connected"
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 database:
 *                   type: string
 *                   example: "disconnected"
 */
app.get('/health', async (_req, res) => {
  const dbHealthy = await db.isHealthy();
  
  if (dbHealthy) {
    res.json({ status: 'healthy', database: 'connected' });
  } else {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Metrics endpoint for Prometheus
/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     description: Expose application metrics in Prometheus format
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// API routes
app.use('/api/metadata', metadataRoutes);
app.use('/api/objects', genericCrudRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/capabilities', capabilityRoutes);
app.use('/api/admin/organization-types', organizationTypeRoutes);
app.use('/api/admin/organizations', organizationRoutes);
app.use('/api/admin/organizations', organizationUserRoutes);
app.use('/api/admin/organizations', organizationRoleRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/orgadmin', membershipRoutes);
app.use('/api/orgadmin', merchandiseRoutes);
app.use('/api/orgadmin', calendarRoutes);
app.use('/api/orgadmin', registrationRoutes);
app.use('/api/orgadmin', ticketingRoutes);
app.use('/api/orgadmin', applicationFormRoutes);
app.use('/api/orgadmin', paymentRoutes);
app.use('/api/orgadmin', reportingRoutes);
app.use('/api/orgadmin/files', fileUploadRoutes);
app.use('/api/orgadmin/users', userManagementRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Load secrets first
    await secretsManager.loadSecrets();
    logger.info('Secrets loaded successfully');
    
    // Initialize database connection
    await db.initialize();
    
    app.listen(PORT, () => {
      logger.info('AWS Web Application Framework - Backend Service');
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

// Only start the server if this file is run directly (not imported by tests)
if (require.main === module) {
  start();
}

export { app };
