/**
 * Property-Based Tests for Organization Admin Role Middleware
 * 
 * Feature: manual-member-addition
 * Property 16: Authorization Enforcement
 * 
 * **Validates: Requirements 7.2, 7.3**
 * 
 * For any user without Organization Administrator role, attempting to access
 * the member creation endpoint should result in a 403 Forbidden error.
 */

import * as fc from 'fast-check';
import { Response } from 'express';
import { requireOrgAdminRole, requireOrgAdmin } from '../../middleware/orgadmin-role.middleware';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { db } from '../../database/pool';

// Mock the database
jest.mock('../../database/pool', () => ({
  db: {
    query: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../../config/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Feature: manual-member-addition, Property 16: Authorization Enforcement', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      user: {
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        roles: [],
        groups: [],
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: Users with admin role can access protected endpoints
   * 
   * For any user with the 'admin' organization role, the middleware should
   * call next() and allow the request to proceed.
   */
  it('should allow access for users with admin role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.emailAddress(), // email
        async (userId, email) => {
          // Setup mock request with user
          mockRequest.user = {
            userId,
            email,
            username: email.split('@')[0],
            roles: [],
            groups: [],
          };

          // Mock database to return admin role
          (db.query as jest.Mock).mockResolvedValue({
            rows: [{ name: 'admin' }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          });

          const middleware = requireOrgAdmin();
          await middleware(
            mockRequest as AuthenticatedRequest,
            mockResponse as Response,
            mockNext
          );

          // Property: next() should be called for admin users
          expect(mockNext).toHaveBeenCalled();
          expect(mockResponse.status).not.toHaveBeenCalledWith(403);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Users without admin role are denied access
   * 
   * For any user without the 'admin' organization role, the middleware should
   * return 403 Forbidden and not call next().
   */
  it('should deny access for users without admin role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.emailAddress(), // email
        fc.constantFrom('viewer', 'editor', 'manager', 'custom-role'), // non-admin role
        async (userId, email, roleName) => {
          // Setup mock request with user
          mockRequest.user = {
            userId,
            email,
            username: email.split('@')[0],
            roles: [],
            groups: [],
          };

          // Mock database to return non-admin role
          (db.query as jest.Mock).mockResolvedValue({
            rows: [{ name: roleName }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          });

          const middleware = requireOrgAdmin();
          await middleware(
            mockRequest as AuthenticatedRequest,
            mockResponse as Response,
            mockNext
          );

          // Property: 403 should be returned for non-admin users
          expect(mockResponse.status).toHaveBeenCalledWith(403);
          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                code: 'FORBIDDEN',
              }),
            })
          );
          expect(mockNext).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Users with no roles are denied access
   * 
   * For any user with no organization roles, the middleware should
   * return 403 Forbidden.
   */
  it('should deny access for users with no roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.emailAddress(), // email
        async (userId, email) => {
          // Setup mock request with user
          mockRequest.user = {
            userId,
            email,
            username: email.split('@')[0],
            roles: [],
            groups: [],
          };

          // Mock database to return no roles
          (db.query as jest.Mock).mockResolvedValue({
            rows: [],
            rowCount: 0,
            command: 'SELECT',
            oid: 0,
            fields: [],
          });

          const middleware = requireOrgAdmin();
          await middleware(
            mockRequest as AuthenticatedRequest,
            mockResponse as Response,
            mockNext
          );

          // Property: 403 should be returned for users with no roles
          expect(mockResponse.status).toHaveBeenCalledWith(403);
          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                code: 'FORBIDDEN',
              }),
            })
          );
          expect(mockNext).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Unauthenticated requests are rejected
   * 
   * For any request without user information, the middleware should
   * return 401 Unauthorized.
   */
  it('should reject unauthenticated requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined), // no user
        async () => {
          // Setup mock request without user
          mockRequest.user = undefined;

          const middleware = requireOrgAdmin();
          await middleware(
            mockRequest as AuthenticatedRequest,
            mockResponse as Response,
            mockNext
          );

          // Property: 401 should be returned for unauthenticated requests
          expect(mockResponse.status).toHaveBeenCalledWith(401);
          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                code: 'UNAUTHORIZED',
              }),
            })
          );
          expect(mockNext).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Multiple roles with admin included grants access
   * 
   * For any user with multiple roles where one is 'admin', the middleware
   * should allow access.
   */
  it('should allow access when admin role is among multiple roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.emailAddress(), // email
        fc.array(fc.constantFrom('viewer', 'editor', 'manager'), { minLength: 1, maxLength: 3 }), // other roles
        async (userId, email, otherRoles) => {
          // Setup mock request with user
          mockRequest.user = {
            userId,
            email,
            username: email.split('@')[0],
            roles: [],
            groups: [],
          };

          // Mock database to return admin role plus other roles
          const roles = ['admin', ...otherRoles].map(name => ({ name }));
          (db.query as jest.Mock).mockResolvedValue({
            rows: roles,
            rowCount: roles.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          });

          const middleware = requireOrgAdmin();
          await middleware(
            mockRequest as AuthenticatedRequest,
            mockResponse as Response,
            mockNext
          );

          // Property: next() should be called when admin role is present
          expect(mockNext).toHaveBeenCalled();
          expect(mockResponse.status).not.toHaveBeenCalledWith(403);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: requireOrgAdminRole accepts array of roles
   * 
   * For any user with at least one of the specified roles, the middleware
   * should allow access.
   */
  it('should allow access when user has any of the specified roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.emailAddress(), // email
        fc.constantFrom('admin', 'manager', 'editor'), // user's role
        async (userId, email, userRole) => {
          // Setup mock request with user
          mockRequest.user = {
            userId,
            email,
            username: email.split('@')[0],
            roles: [],
            groups: [],
          };

          // Mock database to return user's role
          (db.query as jest.Mock).mockResolvedValue({
            rows: [{ name: userRole }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          });

          // Require any of: admin, manager, editor
          const middleware = requireOrgAdminRole(['admin', 'manager', 'editor']);
          await middleware(
            mockRequest as AuthenticatedRequest,
            mockResponse as Response,
            mockNext
          );

          // Property: next() should be called when user has any required role
          expect(mockNext).toHaveBeenCalled();
          expect(mockResponse.status).not.toHaveBeenCalledWith(403);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Database errors are handled gracefully
   * 
   * For any database error, the middleware should return 500 Internal Server Error
   * and not expose the error details.
   */
  it('should handle database errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.emailAddress(), // email
        async (userId, email) => {
          // Setup mock request with user
          mockRequest.user = {
            userId,
            email,
            username: email.split('@')[0],
            roles: [],
            groups: [],
          };

          // Mock database to throw error
          (db.query as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

          const middleware = requireOrgAdmin();
          await middleware(
            mockRequest as AuthenticatedRequest,
            mockResponse as Response,
            mockNext
          );

          // Property: 500 should be returned for database errors
          expect(mockResponse.status).toHaveBeenCalledWith(500);
          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                code: 'INTERNAL_ERROR',
              }),
            })
          );
          expect(mockNext).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Role names are case-sensitive
   * 
   * For any user with a role that differs only in case from 'admin',
   * the middleware should deny access.
   */
  it('should enforce case-sensitive role matching', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.emailAddress(), // email
        fc.constantFrom('Admin', 'ADMIN', 'AdMiN'), // case variations
        async (userId, email, roleName) => {
          // Setup mock request with user
          mockRequest.user = {
            userId,
            email,
            username: email.split('@')[0],
            roles: [],
            groups: [],
          };

          // Mock database to return role with different case
          (db.query as jest.Mock).mockResolvedValue({
            rows: [{ name: roleName }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          });

          const middleware = requireOrgAdmin();
          await middleware(
            mockRequest as AuthenticatedRequest,
            mockResponse as Response,
            mockNext
          );

          // Property: Only lowercase 'admin' should grant access
          expect(mockResponse.status).toHaveBeenCalledWith(403);
          expect(mockNext).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });
});
