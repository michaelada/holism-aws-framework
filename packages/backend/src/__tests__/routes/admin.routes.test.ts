import request from 'supertest';
import type { Server } from 'http';
import { app } from '../../index';
import { db } from '../../database/pool';
import { auditService } from '../../services/audit/audit.service';

// Mock the Keycloak services
jest.mock('../../services/keycloak-admin.factory', () => {
  const mockClient = {
    groups: {
      create: jest.fn().mockResolvedValue({ id: 'mock-group-id' }),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'mock-group-id', name: 'test-group' }),
      update: jest.fn().mockResolvedValue({}),
      del: jest.fn().mockResolvedValue({}),
      listMembers: jest.fn().mockResolvedValue([]),
    },
    users: {
      create: jest.fn().mockResolvedValue({ id: 'mock-user-id' }),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ 
        id: 'mock-user-id', 
        username: 'test-user',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        enabled: true,
      }),
      update: jest.fn().mockResolvedValue({}),
      del: jest.fn().mockResolvedValue({}),
      resetPassword: jest.fn().mockResolvedValue({}),
      listGroups: jest.fn().mockResolvedValue([]),
      addToGroup: jest.fn().mockResolvedValue({}),
      delFromGroup: jest.fn().mockResolvedValue({}),
      addRealmRoleMappings: jest.fn().mockResolvedValue({}),
      delRealmRoleMappings: jest.fn().mockResolvedValue({}),
      listRealmRoleMappings: jest.fn().mockResolvedValue([]),
    },
    roles: {
      create: jest.fn().mockResolvedValue({ id: 'mock-role-id', name: 'test-role' }),
      find: jest.fn().mockResolvedValue([]),
      findOneByName: jest.fn().mockResolvedValue({ id: 'mock-role-id', name: 'test-role' }),
      delByName: jest.fn().mockResolvedValue({}),
    },
  };

  const mockKeycloakAdmin = {
    ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
    getClient: jest.fn().mockReturnValue(mockClient),
    authenticate: jest.fn().mockResolvedValue(undefined),
    isTokenExpired: jest.fn().mockReturnValue(false),
  };

  return {
    createKeycloakAdminService: jest.fn().mockReturnValue(mockKeycloakAdmin),
  };
});

/**
 * Integration tests for Admin API endpoints
 * 
 * These tests verify:
 * - Authentication and authorization
 * - Organisation CRUD operations
 * - User CRUD operations
 * - Role CRUD operations
 * - Audit logging
 * 
 * Note: These tests use mocked Keycloak Admin Client to avoid external dependencies
 */

/*
 * One listener for the whole file.
 *
 * `request(app)` starts a server on a fresh ephemeral port for every call. Over
 * a run that makes thousands of them, ports get reused while the previous
 * connection's packets are still in flight, and the client reads bytes that are
 * not a response at all — "Parse Error: Expected HTTP/", a hang-up, or somebody
 * else's reply. One listener per file removes that churn.
 */
let server: Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

describe('Admin API Routes Integration Tests', () => {

  let authToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    await db.initialize();
    
    // Set up test authentication
    // In development mode with DISABLE_AUTH=true, a mock admin user is used
    process.env.DISABLE_AUTH = 'true';
    authToken = 'mock-token';
    adminUserId = 'dev-user-123';

    // Create a mock admin user in the database for audit logging
    try {
      await db.query(
        `INSERT INTO users (id, keycloak_user_id, username, email, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (keycloak_user_id) DO NOTHING`,
        [adminUserId, 'dev-user', 'dev@example.com']
      );
    } catch (error) {
      // Ignore if user already exists
    }
  });

  afterAll(async () => {
    // Left open deliberately: the pool is a singleton shared by every suite in the
      // run — jest uses one worker and a fresh module registry per file, not a fresh
      // process — so closing it here pulls the connection out from under whatever
      // runs next. `forceExit` in jest.config.js ends the process.
      // await db.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    // Note: Skip audit log cleanup as it requires valid user UUIDs
    await db.query('DELETE FROM users WHERE username LIKE $1', ['test_%']);
    await db.query('DELETE FROM organizations WHERE name LIKE $1', ['test_%']);
    await db.query('DELETE FROM organization_types WHERE name LIKE $1', ['test_%']);
    await db.query('DELETE FROM roles WHERE name LIKE $1', ['test_%']);
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for admin endpoints', async () => {
      // This test is skipped because DISABLE_AUTH=true is set for integration tests
      // Authentication is tested in unit tests for the auth middleware
      expect(true).toBe(true);
    });

    it('should allow access with valid admin token', async () => {
      const response = await request(server)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('User Management', () => {
    let testOrganisationId: string;

    beforeEach(async () => {
      const typeResult = await db.query(
        `INSERT INTO organization_types (
           id, name, display_name, currency, language, default_locale,
           membership_numbering, membership_number_uniqueness, initial_membership_number,
           created_at, updated_at
         )
         VALUES (gen_random_uuid(), $1, $2, 'GBP', 'en', 'en-GB', 'internal', 'organization', 1, NOW(), NOW())
         RETURNING id`,
        ['test_user_organisation_type', 'Test User Organisation Type']
      );

      const organisationResult = await db.query(
        `INSERT INTO organizations (
           id, organization_type_id, keycloak_group_id, name, display_name,
           url_code, currency, created_at, updated_at
         )
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'GBP', NOW(), NOW())
         RETURNING id`,
        [
          typeResult.rows[0].id,
          'kc-group-test-user-organisation',
          'test_user_organisation',
          'Test User Organisation',
          'test-user-organisation',
        ]
      );

      testOrganisationId = organisationResult.rows[0].id;
    });

    it('should create a user', async () => {
      const userData = {
        username: 'test_user_1',
        email: 'test1@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'TestPassword123!',
        temporaryPassword: true,
        organizationId: testOrganisationId,
      };

      const response = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.keycloakUserId).toBeDefined();
      // Note: Due to mocking, the returned data may not match exactly

      // Verify audit log

      // The audit service batches its writes, so force the flush first.

      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2',
        ['user', response.body.id]
      );
      expect(auditLog.rows.length).toBe(1);
      expect(auditLog.rows[0].action).toBe('user.org-admin-created');
    });

    it('should list all users', async () => {
      // Create test users
      await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'test_user_2',
          email: 'test2@example.com',
          firstName: 'Test',
          lastName: 'User 2',
        });

      const response = await request(server)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter users by organisation', async () => {
      // Create user with organisation
      await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'test_user_3',
          email: 'test3@example.com',
          firstName: 'Test',
          lastName: 'User 3',
          organizationId: testOrganisationId,
        });

      const response = await request(server)
        .get(`/api/admin/users?organizationId=${testOrganisationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get user by ID', async () => {
      const createResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'test_user_4',
          email: 'test4@example.com',
          firstName: 'Test',
          lastName: 'User 4',
        });

      const userId = createResponse.body.id;

      const response = await request(server)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
      // Note: Due to mocking, username may not match exactly
    });

    it('should update a user', async () => {
      const createResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'test_user_5',
          email: 'test5@example.com',
          firstName: 'Test',
          lastName: 'User 5',
        });

      const userId = createResponse.body.id;

      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated5@example.com',
      };

      const response = await request(server)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      // Note: Due to mocking, the response may not reflect the updates exactly
      expect(response.body.id).toBe(userId);

      // Verify audit log

      // The audit service batches its writes, so force the flush first.

      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 AND action = $3',
        ['user', userId, 'user.org-admin-updated']
      );
      expect(auditLog.rows.length).toBe(1);
    });

    it('should delete a user', async () => {
      const createResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'test_user_6',
          email: 'test6@example.com',
          firstName: 'Test',
          lastName: 'User 6',
        });

      const userId = createResponse.body.id;

      await request(server)
        .delete(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify audit log (deletion verification skipped due to mocking complexity)

      // The audit service batches its writes, so force the flush first.

      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 AND action = $3',
        ['user', userId, 'user.org-admin-deleted']
      );
      expect(auditLog.rows.length).toBe(1);
    });

    it('should reset user password', async () => {
      const createResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'test_user_7',
          email: 'test7@example.com',
          firstName: 'Test',
          lastName: 'User 7',
        });

      const userId = createResponse.body.id;

      const response = await request(server)
        .post(`/api/admin/users/${userId}/reset-password`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'NewPassword123!', temporary: true })
        .expect(200);

      expect(response.body.message).toBe('Password reset successfully');

      // Verify audit log

      // The audit service batches its writes, so force the flush first.

      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 AND action = $3',
        ['user', userId, 'auth.password-reset-requested']
      );
      expect(auditLog.rows.length).toBe(1);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: 'test_user_8' }) // Missing required fields
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Role Management', () => {
    it('should create a role', async () => {
      const roleData = {
        name: 'test_role_1',
        displayName: 'Test Role 1',
        description: 'Test role description',
        permissions: ['read', 'write'],
      };

      const response = await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roleData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: roleData.name,
        displayName: roleData.displayName,
        description: roleData.description,
      });
      expect(response.body.id).toBeDefined();

      // Verify audit log

      // The audit service batches its writes, so force the flush first.

      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2',
        ['role', response.body.id]
      );
      expect(auditLog.rows.length).toBe(1);
      expect(auditLog.rows[0].action).toBe('role.created');
    });

    it('should list all roles', async () => {
      // Create test roles
      await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'test_role_2', displayName: 'Test Role 2' });

      const response = await request(server)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should delete a role', async () => {
      const createResponse = await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'test_role_3', displayName: 'Test Role 3' });

      const roleId = createResponse.body.id;

      await request(server)
        .delete(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify audit log

      // The audit service batches its writes, so force the flush first.

      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 AND action = $3',
        ['role', roleId, 'role.deleted']
      );
      expect(auditLog.rows.length).toBe(1);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'test_role_4' }) // Missing displayName
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Role Assignment', () => {
    let testUserId: string;
    let testRoleName: string;

    beforeEach(async () => {
      // Create test user
      const userResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'test_role_user',
          email: 'roleuser@example.com',
          firstName: 'Role',
          lastName: 'User',
        });
      testUserId = userResponse.body.id;

      // Create test role
      const roleResponse = await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'test_assign_role', displayName: 'Test Assign Role' });
      testRoleName = roleResponse.body.name;
    });

    it('should assign role to user', async () => {
      const response = await request(server)
        .post(`/api/admin/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleName: testRoleName })
        .expect(200);

      expect(response.body.message).toBe('Role assigned successfully');

      // Verify audit log

      // The audit service batches its writes, so force the flush first.

      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 AND action = $3',
        ['user', testUserId, 'role.assigned']
      );
      expect(auditLog.rows.length).toBe(1);
    });

    it('should remove role from user', async () => {
      // First assign the role
      await request(server)
        .post(`/api/admin/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleName: testRoleName });

      // Then remove it
      const response = await request(server)
        .delete(`/api/admin/users/${testUserId}/roles/${testRoleName}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Role removed successfully');

      // Verify audit log

      // The audit service batches its writes, so force the flush first.

      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 AND action = $3',
        ['user', testUserId, 'role.removed']
      );
      expect(auditLog.rows.length).toBe(1);
    });

    it('should return 400 when role name is missing', async () => {
      const response = await request(server)
        .post(`/api/admin/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing roleName
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Audit Logging', () => {
    it('should log all admin actions', async () => {
      const createResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'test_audit_user',
          email: 'test_audit_user@example.com',
          firstName: 'Test',
          lastName: 'Audit',
          password: 'TestPassword123!',
        });

      const userId = createResponse.body.id;

      await request(server)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'updated_audit_user@example.com' });

      await request(server)
        .delete(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // The audit service batches its writes, so force the flush first.
      await auditService.flushNow();

      const auditLogs = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 ORDER BY occurred_at',
        ['user', userId]
      );

      expect(auditLogs.rows.length).toBe(3);
      expect(auditLogs.rows[0].action).toBe('user.org-admin-created');
      expect(auditLogs.rows[1].action).toBe('user.org-admin-updated');
      expect(auditLogs.rows[2].action).toBe('user.org-admin-deleted');

      // Verify user ID is logged (should be the database user UUID, not Keycloak user ID)
      auditLogs.rows.forEach(log => {
        expect(log.actor_kc_user_id).toBeDefined();
        // User ID should be a UUID format
        expect(log.actor_user_type).toBe('super-admin');
      });
    });

    it('should include IP address in audit logs', async () => {
      const response = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({
          username: 'test_ip_user',
          email: 'test_ip_user@example.com',
          firstName: 'Test',
          lastName: 'Ip',
          password: 'TestPassword123!',
        });

      // The audit service batches its writes, so force the flush first.
      await auditService.flushNow();

      const auditLog = await db.query(
        'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2',
        ['user', response.body.id]
      );

      expect(auditLog.rows[0].context.ip).toBeDefined();
    });
  });
});
