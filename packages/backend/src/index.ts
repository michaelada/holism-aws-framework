import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { db } from './database/pool';
import { logger } from './config/logger';
import { secretsManager } from './config/secrets';
import { ForbiddenError } from './middleware/errors';
import {
  errorHandler,
  requestLogger,
  metricsMiddleware,
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  apiRateLimit,
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
import paymentMethodRoutes from './routes/payment-method.routes';
import organizationPaymentMethodRoutes from './routes/organization-payment-method.routes';
import eventRoutes from './routes/event.routes';
import eventTypeRoutes from './routes/event-type.routes';
import venueRoutes from './routes/venue.routes';
import discountRoutes from './routes/discount.routes';
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
import orgadminAuthRoutes from './routes/orgadmin-auth.routes';
import orgadminOrganisationRoutes from './routes/orgadmin-organisation.routes';
import webhookRoutes from './routes/webhook.routes';
import { allowedOrigins as allowedOriginList } from './utils/allowed-origins';
import userPreferencesRoutes from './routes/user-preferences.routes';
import userGroupRoutes from './routes/user-group.routes';
import publicRoutes from './routes/public.routes';
import accountRoutes from './routes/account.routes';
import { swaggerSpec } from './config/swagger';
import { register } from './config/metrics';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3000;

// CORS must be configured BEFORE helmet so preflight OPTIONS requests are handled correctly
// Single definition, shared with the redirect check in
// utils/allowed-origins.ts — two copies of this list drift.
const allowedOrigins = allowedOriginList();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow any localhost origin
    if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    /*
     * A refusal, not a fault. Thrown as a plain Error this became a 500
     * "Unexpected error", which is what made the real cause invisible: the
     * deployment refused its own origin, every write in every application
     * failed, and the browser saw a server error with no explanation. A 403
     * naming the origin says what happened.
     *
     * Still refused rather than merely un-headered. `callback(null, false)`
     * would let the request reach the handler and be executed — the browser
     * would block only the *response*, so a cross-site write would already
     * have happened.
     */
    logger.warn('Refused a request from an untrusted origin', {
      origin,
      allowedOrigins,
      hint: 'Set PUBLIC_URL to the origin this deployment is served from.',
    });
    return callback(new ForbiddenError(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  /*
   * `X-Organisation-Id` is required, not optional.
   *
   * The org-admin app sends it on every call to say which organisation the
   * administrator is working in — an administrator may belong to several. A
   * header the browser has not been told is allowed fails the CORS *preflight*,
   * so the real request is never sent: the console reports "Network Error" and
   * the screen shows an authentication failure, neither of which points at a
   * missing header.
   */
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Organisation-Id']
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'http://localhost:*'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  // Disable HSTS in development (it causes issues with localhost)
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  // Don't set crossOriginResourcePolicy in development
  crossOriginResourcePolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

/*
 * XSS-related response headers come from helmet() above:
 * X-Content-Type-Options, X-Frame-Options, Referrer-Policy and X-XSS-Protection.
 *
 * `xssSecurityHeaders()` in middleware/xss-protection.middleware.ts is no longer
 * applied here. It additionally set `Permissions-Policy`, which helmet does not,
 * so that header is currently absent — see docs/BACKEND_TEST_SUITE_REPAIR.md.
 */

// Body parsing and cookie parsing
/*
 * Webhooks mount BEFORE the JSON parser, and this order is load-bearing.
 *
 * A provider signs the exact bytes it sent. `express.json()` parses and
 * discards them, so a router mounted after it can only re-serialise the object
 * — which produces different bytes and fails every signature check. The webhook
 * router applies `express.raw()` itself.
 */
app.use('/api/webhooks', webhookRoutes);

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
app.use('/api/admin/payment-methods', paymentMethodRoutes);
app.use('/api/admin/organization-types', organizationTypeRoutes);
app.use('/api/admin/organizations', organizationRoutes);
app.use('/api/admin/organizations', organizationPaymentMethodRoutes);
app.use('/api/admin/organizations', organizationUserRoutes);
app.use('/api/admin/organizations', organizationRoleRoutes);
/*
 * Auth first, and never organisation-scoped: `/auth/me` is how an administrator
 * finds out which organisations they have, so it cannot require one.
 */
app.use('/api/orgadmin', orgadminAuthRoutes);
app.use('/api/orgadmin/organisation', orgadminOrganisationRoutes);
app.use('/api/orgadmin/users', userManagementRoutes);

/*
 * The data routers, mounted twice.
 *
 *   /api/orgadmin/organisations/:organisationId/events/:id   ← what clients send
 *   /api/orgadmin/events/:id                                 ← still accepted
 *
 * The scoped form is the one the org-admin app now uses, and the one that shows
 * up in a log: a request that says which club it is about is legible without
 * cross-referencing a header against a session.
 *
 * Both are equally safe. Every route establishes and verifies its organisation
 * for itself (`organisation-scope.middleware`), and where the path names one it
 * must **agree** with the resource being acted on — so the prefix cannot be used
 * to claim a club the resource does not belong to. The unscoped mounts remain
 * because `/auth/*` and a handful of direct callers still use them; removing
 * them is a deprecation, not a fix.
 */
const ORGADMIN_DATA_ROUTERS: [string, express.Router][] = [
  ['', eventRoutes],
  ['', eventTypeRoutes],
  ['', venueRoutes],
  ['', discountRoutes],
  ['', membershipRoutes],
  ['', merchandiseRoutes],
  ['', calendarRoutes],
  ['', registrationRoutes],
  ['', ticketingRoutes],
  ['', applicationFormRoutes],
  ['', paymentRoutes],
  ['', reportingRoutes],
  ['', userGroupRoutes],
  ['/files', fileUploadRoutes],
];

/*
 * **Bare first, scoped second, and the order is load-bearing.**
 *
 * A router's own paths already include the scoped collections — discounts has
 * `/organisations/:organisationId/discounts/:moduleType`. Mounting the scoped
 * prefix first strips `/organisations/X` off and offers the remainder,
 * `/discounts/events`, to the same router — where `/discounts/:id` matches it
 * happily and reads "events" as a discount id. The request becomes a different
 * request, and answers 400 instead of a list.
 *
 * Registering the bare mount first means the fully-specified route wins where
 * one exists, and anything it does not match falls through to the scoped mount
 * and has the prefix stripped as intended.
 */
for (const [suffix, routerToMount] of ORGADMIN_DATA_ROUTERS) {
  app.use(`/api/orgadmin${suffix}`, routerToMount);
  app.use(`/api/orgadmin/organisations/:organisationId${suffix}`, routerToMount);
}
app.use('/api/user-preferences', userPreferencesRoutes);

// Account-user application. /api/public/* is deliberately unauthenticated —
// it backs the organisation directory and sign-in gateway, which a member
// reaches before they have a session. /api/account/* requires a token and
// resolves the organisation from the URL rather than from the token, because
// an account user may belong to several.
app.use('/api/public', publicRoutes);
app.use('/api/account', accountRoutes);

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
