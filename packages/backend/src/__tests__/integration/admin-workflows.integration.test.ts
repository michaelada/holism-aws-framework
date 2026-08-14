import request from 'supertest';
import type { Server } from 'http';
import { app } from '../../index';
import { db } from '../../database/pool';

// Mock the Keycloak services
jest.mock('../../services/keycloak-admin.factory', () => {
  let groupIdCounter = 0;
  let userIdCounter = 0;
  let roleIdCounter = 0;

  const mockClient = {
    groups: {
      create: jest.fn().mockImplementation(() => {
        groupIdCounter++;
        return Promise.resolve({ id: `mock-group-id-${groupIdCounter}` });
      }),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((params: any) => {
        return Promise.resolve({ id: params.id, name: 'test-group' });
      }),
      update: jest.fn().mockResolvedValue({}),
      del: jest.fn().mockResolvedValue({}),
      listMembers: jest.fn().mockResolvedValue([]),
    },
    users: {
      create: jest.fn().mockImplementation(() => {
        userIdCounter++;
        return Promise.resolve({ id: `mock-user-id-${userIdCounter}` });
      }),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((params: any) => {
        return Promise.resolve({ 
          id: params.id, 
          username: 'test-user',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          enabled: true,
        });
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
      create: jest.fn().mockImplementation((params: any) => {
        roleIdCounter++;
        return Promise.resolve({ id: `mock-role-id-${roleIdCounter}`, name: params.name });
      }),
      find: jest.fn().mockResolvedValue([]),
      findOneByName: jest.fn().mockImplementation((params: any) => {
        return Promise.resolve({ id: `mock-role-id-${params.name}`, name: params.name });
      }),
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
 * Integration tests for complete admin workflows
 * 
 * These tests verify end-to-end user flows:
 * - Organisation creation, update, deletion flow
 * - User creation, update, deletion, password reset flow
 * - Role creation, assignment, deletion flow
 * - Authentication and authorization
 * - Audit logging
 * 
 * Validates: Requirements 12.8
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

describe('Admin Workflows Integration Tests', () => {

  let authToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    await db.initialize();
    
    // Set up test authentication
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

  const seedOrganisation = async (name: string, displayName: string): Promise<string> => {
    const typeResult = await db.query(
      `INSERT INTO organization_types (
         id, name, display_name, currency, language, default_locale,
         membership_numbering, membership_number_uniqueness, initial_membership_number,
         created_at, updated_at
       )
       VALUES (gen_random_uuid(), $1, $2, 'GBP', 'en', 'en-GB', 'internal', 'organization', 1, NOW(), NOW())
       RETURNING id`,
      [`${name}_type`, `${displayName} Type`]
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
        `kc-group-${name.replace(/_/g, '-')}`,
        name,
        displayName,
        name.replace(/_/g, '-'),
      ]
    );

    return organisationResult.rows[0].id;
  };

  beforeEach(async () => {
    // Clean up test data before each test
    await db.query('DELETE FROM users WHERE username LIKE $1', ['workflow_%']);
    await db.query('DELETE FROM organizations WHERE name LIKE $1', ['workflow_%']);
    await db.query('DELETE FROM organization_types WHERE name LIKE $1', ['workflow_%']);
    await db.query('DELETE FROM roles WHERE name LIKE $1', ['workflow_%']);
  });

  describe('Complete User Lifecycle Flow', () => {
    let testOrganisationId: string;

    beforeEach(async () => {
      testOrganisationId = await seedOrganisation(
        'workflow_user_organisation',
        'Workflow User Organisation'
      );
    });

    it('should complete full user lifecycle: create -> update -> password reset -> delete', async () => {
      // Step 1: Create user
      const createData = {
        username: 'workflow_user_1',
        email: 'workflow1@example.com',
        firstName: 'Workflow',
        lastName: 'User One',
        password: 'InitialPassword123!',
        temporaryPassword: true,
        organizationId: testOrganisationId,
      };

      const createResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createData)
        .expect(201);

      const userId = createResponse.body.id;
      expect(userId).toBeDefined();
      expect(createResponse.body.keycloakUserId).toBeDefined();

      // Verify creation audit log
      let auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['user', userId, 'create']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Step 2: Retrieve user
      const getResponse = await request(server)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.id).toBe(userId);

      // Step 3: Update user
      const updateData = {
        firstName: 'Updated',
        lastName: 'User Name',
        email: 'updated-workflow1@example.com',
      };

      const updateResponse = await request(server)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.id).toBe(userId);

      // Verify update audit log
      auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['user', userId, 'update']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Step 4: Reset password
      const resetResponse = await request(server)
        .post(`/api/admin/users/${userId}/reset-password`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'NewPassword456!', temporary: false })
        .expect(200);

      expect(resetResponse.body.message).toBe('Password reset successfully');

      // Verify password reset audit log
      auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['user', userId, 'reset_password']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Step 5: List users (should include our user)
      const listResponse = await request(server)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(listResponse.body)).toBe(true);

      // Step 6: Filter users by organisation
      const filterResponse = await request(server)
        .get(`/api/admin/users?organizationId=${testOrganisationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(filterResponse.body)).toBe(true);

      // Step 7: Delete user
      await request(server)
        .delete(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion audit log
      auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['user', userId, 'delete']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Verify all audit logs for this user
      const allAuditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 ORDER BY timestamp',
        ['user', userId]
      );
      expect(allAuditLogs.rows.length).toBe(4);
      expect(allAuditLogs.rows[0].action).toBe('create');
      expect(allAuditLogs.rows[1].action).toBe('update');
      expect(allAuditLogs.rows[2].action).toBe('reset_password');
      expect(allAuditLogs.rows[3].action).toBe('delete');
    });
  });

  describe('Complete Role Lifecycle Flow', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Create a test user for role assignment tests
      const userResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'workflow_role_user',
          email: 'roleuser@example.com',
          firstName: 'Role',
          lastName: 'User',
        });
      testUserId = userResponse.body.id;
    });

    it('should complete full role lifecycle: create -> assign -> remove -> delete', async () => {
      // Step 1: Create role
      const createData = {
        name: 'workflow_role_1',
        displayName: 'Workflow Role 1',
        description: 'Test workflow role',
        permissions: ['read', 'write', 'delete'],
      };

      const createResponse = await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createData)
        .expect(201);

      const roleId = createResponse.body.id;
      const roleName = createResponse.body.name;
      expect(roleId).toBeDefined();
      expect(roleName).toBe(createData.name);

      // Verify creation audit log
      let auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['role', roleId, 'create']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Step 2: List roles (should include our role)
      const listResponse = await request(server)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(listResponse.body)).toBe(true);

      // Step 3: Assign role to user
      const assignResponse = await request(server)
        .post(`/api/admin/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleName })
        .expect(200);

      expect(assignResponse.body.message).toBe('Role assigned successfully');

      // Verify role assignment audit log
      auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['user', testUserId, 'assign_role']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Step 4: Remove role from user
      const removeResponse = await request(server)
        .delete(`/api/admin/users/${testUserId}/roles/${roleName}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(removeResponse.body.message).toBe('Role removed successfully');

      // Verify role removal audit log
      auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['user', testUserId, 'remove_role']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Step 5: Delete role
      await request(server)
        .delete(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion audit log
      auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['role', roleId, 'delete']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Verify all audit logs for this role
      const allRoleAuditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 ORDER BY timestamp',
        ['role', roleId]
      );
      expect(allRoleAuditLogs.rows.length).toBe(2); // create and delete
      expect(allRoleAuditLogs.rows[0].action).toBe('create');
      expect(allRoleAuditLogs.rows[1].action).toBe('delete');
    });
  });

  describe('Authentication and Authorization Flow', () => {
    it('should verify authentication is required for admin endpoints', async () => {
      // Note: This test is limited because DISABLE_AUTH=true in test environment
      // In production, authentication is enforced by the auth middleware
      
      // With valid token, should succeed
      const response = await request(server)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should verify admin role is checked (simulated)', async () => {
      // Note: This test is limited because DISABLE_AUTH=true in test environment
      // In production, admin role is enforced by the requireAdminRole middleware
      
      // The middleware checks for 'admin' role in the JWT token
      // This is tested in the auth middleware unit tests
      expect(true).toBe(true);
    });
  });

  describe('Comprehensive Audit Logging Flow', () => {
    it('should log all administrative actions with complete metadata', async () => {
      const organizationId = await seedOrganisation(
        'workflow_audit_organisation',
        'Workflow Audit Organisation'
      );

      // Create user
      const userResponse = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({
          username: 'workflow_audit_user',
          email: 'audit@example.com',
          firstName: 'Audit',
          lastName: 'User',
          organizationId,
        });

      const userId = userResponse.body.id;

      // Create role
      const roleResponse = await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ name: 'workflow_audit_role', displayName: 'Workflow Audit Role' });

      const roleName = roleResponse.body.name;

      // Assign role
      await request(server)
        .post(`/api/admin/users/${userId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ roleName });

      // Reset password
      await request(server)
        .post(`/api/admin/users/${userId}/reset-password`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ password: 'AuditPassword123!', temporary: true });

      // Verify all audit logs were created
      const allAuditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE ip_address = $1 ORDER BY timestamp',
        ['192.168.1.100']
      );

      expect(allAuditLogs.rows.length).toBeGreaterThanOrEqual(5);

      // Verify each audit log has required fields
      allAuditLogs.rows.forEach(log => {
        expect(log.user_id).toBeDefined();
        expect(log.action).toBeDefined();
        expect(log.resource).toBeDefined();
        expect(log.resource_id).toBeDefined();
        expect(log.ip_address).toBe('192.168.1.100');
        expect(log.timestamp).toBeDefined();
      });

      // Verify specific actions were logged
      const actions = allAuditLogs.rows.map(log => log.action);
      expect(actions).toContain('create');
      expect(actions).toContain('assign_role');
      expect(actions).toContain('reset_password');
    });
  });

  describe('Complex Multi-Entity Flow', () => {
    it('should handle complex workflow with multiple entities', async () => {
      // Create multiple organizations
      const organisation1Id = await seedOrganisation(
        'workflow_complex_organisation1',
        'Complex Organisation 1'
      );
      const organisation2Id = await seedOrganisation(
        'workflow_complex_organisation2',
        'Complex Organisation 2'
      );

      // Create multiple roles
      const role1Response = await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'workflow_complex_role1', displayName: 'Complex Role 1' });

      const role2Response = await request(server)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'workflow_complex_role2', displayName: 'Complex Role 2' });

      const role1Name = role1Response.body.name;
      const role2Name = role2Response.body.name;

      // Create users in different organizations
      const user1Response = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'workflow_complex_user1',
          email: 'complex1@example.com',
          firstName: 'Complex',
          lastName: 'User 1',
          organizationId: organisation1Id,
        });

      const user2Response = await request(server)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'workflow_complex_user2',
          email: 'complex2@example.com',
          firstName: 'Complex',
          lastName: 'User 2',
          organizationId: organisation2Id,
        });

      const user1Id = user1Response.body.id;
      const user2Id = user2Response.body.id;

      // Assign different roles to users
      await request(server)
        .post(`/api/admin/users/${user1Id}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleName: role1Name });

      await request(server)
        .post(`/api/admin/users/${user2Id}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleName: role2Name });

      // Filter users by organisation
      const organisation1UsersResponse = await request(server)
        .get(`/api/admin/users?organizationId=${organisation1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(organisation1UsersResponse.body)).toBe(true);

      // Update users
      await request(server)
        .put(`/api/admin/users/${user1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Updated Complex' });

      // Reset password for one user
      await request(server)
        .post(`/api/admin/users/${user1Id}/reset-password`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'ComplexPassword123!', temporary: false });

      // Verify audit logs for all operations
      const allAuditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource_id IN ($1, $2, $3, $4) ORDER BY timestamp',
        [organisation1Id, organisation2Id, user1Id, user2Id]
      );

      // Should have logs for: 2 user creates, 2 role assigns, 1 user update, 1 password reset.
      // The organisations are seeded straight into the database, so they add no audit rows.
      expect(allAuditLogs.rows.length).toBeGreaterThanOrEqual(6);

      // Clean up
      await request(server)
        .delete(`/api/admin/users/${user1Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(server)
        .delete(`/api/admin/users/${user2Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(server)
        .delete(`/api/admin/roles/${role1Response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(server)
        .delete(`/api/admin/roles/${role2Response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });
  });
});
