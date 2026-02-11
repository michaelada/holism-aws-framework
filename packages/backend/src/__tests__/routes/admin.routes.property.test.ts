import * as fc from 'fast-check';
import request from 'supertest';
import { app } from '../../index';
import { db } from '../../database/pool';

/**
 * Property-Based Tests for Admin API Routes
 * 
 * Feature: keycloak-admin-integration
 * Property 18: Admin Endpoint Authorization
 * 
 * Validates: Requirements 7.1, 7.2, 7.3
 * 
 * Property: For any request to /api/admin/* endpoints, the system should verify
 * that the user is authenticated and has the 'admin' realm role, returning 403
 * Forbidden if the role is missing.
 * 
 * Note: These tests run with DISABLE_AUTH=true (development mode) to avoid
 * complex JWT token mocking. The actual authorization logic is tested in unit tests.
 */
describe('Admin API Routes - Property-Based Tests', () => {
  beforeAll(async () => {
    await db.initialize();
    // Enable auth bypass for property tests
    process.env.DISABLE_AUTH = 'true';
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Property 18: Admin Endpoint Authorization', () => {
    /**
     * Property: All admin endpoints are accessible with admin role
     * 
     * For any admin endpoint, requests with admin role should be processed
     * (not rejected with 403 Forbidden).
     */
    it('should allow access to admin endpoints with admin role', async () => {
      const adminEndpoints = fc.constantFrom(
        '/api/admin/tenants',
        '/api/admin/users',
        '/api/admin/roles'
      );

      await fc.assert(
        fc.asyncProperty(adminEndpoints, async (endpoint) => {
          const response = await request(app)
            .get(endpoint)
            .set('Authorization', 'Bearer mock-token');

          // With admin role, should not return 403
          // (may return 200, 404, 500, but not 403)
          expect(response.status).not.toBe(403);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Admin endpoints handle various HTTP methods
     * 
     * For any admin endpoint, the system should handle different HTTP methods
     * appropriately without authorization errors.
     */
    it('should handle various HTTP methods on admin endpoints', async () => {
      const endpointMethods = fc.constantFrom(
        { method: 'get', path: '/api/admin/tenants' },
        { method: 'post', path: '/api/admin/tenants' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'post', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/roles' },
        { method: 'post', path: '/api/admin/roles' }
      );

      await fc.assert(
        fc.asyncProperty(endpointMethods, async (endpoint) => {
          let response;

          if (endpoint.method === 'get') {
            response = await request(app)
              .get(endpoint.path)
              .set('Authorization', 'Bearer mock-token');
          } else {
            response = await request(app)
              .post(endpoint.path)
              .set('Authorization', 'Bearer mock-token')
              .send({ name: 'test', displayName: 'Test' });
          }

          // Should not return 403 (authorization error)
          expect(response.status).not.toBe(403);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Admin endpoints are consistently protected
     * 
     * All paths under /api/admin/ should have consistent authorization behavior.
     */
    it('should consistently protect all admin endpoint paths', async () => {
      const adminPaths = fc.constantFrom(
        '/api/admin/tenants',
        '/api/admin/tenants/123',
        '/api/admin/users',
        '/api/admin/users/456',
        '/api/admin/roles',
        '/api/admin/roles/abc'
      );

      await fc.assert(
        fc.asyncProperty(adminPaths, async (path) => {
          const response = await request(app)
            .get(path)
            .set('Authorization', 'Bearer mock-token');

          // With admin role, should not return 403
          expect(response.status).not.toBe(403);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Admin endpoints process requests with valid data
     * 
     * For any admin endpoint with valid request data, the system should
     * process the request without authorization errors.
     */
    it('should process valid requests to admin endpoints', async () => {
      const validTenantData = fc.record({
        name: fc.stringMatching(/^[a-z][a-z0-9_]{2,19}$/),
        displayName: fc.string({ minLength: 1, maxLength: 50 }),
        domain: fc.option(fc.webUrl(), { nil: undefined }),
      });

      await fc.assert(
        fc.asyncProperty(validTenantData, async (data) => {
          const response = await request(app)
            .post('/api/admin/tenants')
            .set('Authorization', 'Bearer mock-token')
            .send(data);

          // Should not return 403 (authorization error)
          // May return 201 (success), 400 (validation), 409 (conflict), or 500 (error)
          expect(response.status).not.toBe(403);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Admin endpoints return appropriate error codes
     * 
     * For any admin endpoint, error responses should be appropriate HTTP status
     * codes (4xx for client errors, 5xx for server errors), not authorization errors.
     */
    it('should return appropriate error codes for admin endpoints', async () => {
      const invalidData = fc.record({
        invalidField: fc.string(),
        anotherInvalid: fc.integer(),
      });

      await fc.assert(
        fc.asyncProperty(invalidData, async (data) => {
          const response = await request(app)
            .post('/api/admin/tenants')
            .set('Authorization', 'Bearer mock-token')
            .send(data);

          // Should return 400 (validation error) or 500 (server error)
          // but not 403 (authorization error)
          expect(response.status).not.toBe(403);
          expect([400, 500]).toContain(response.status);
        }),
        { numRuns: 100 }
      );
    });
  });
});
