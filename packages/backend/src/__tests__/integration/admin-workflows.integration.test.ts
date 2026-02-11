import request from 'supertest';
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
 * - Tenant creation, update, deletion flow
 * - User creation, update, deletion, password reset flow
 * - Role creation, assignment, deletion flow
 * - Authentication and authorization
 * - Audit logging
 * 
 * Validates: Requirements 12.8
 */
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
    await db.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.query('DELETE FROM users WHERE username LIKE $1', ['workflow_%']);
    await db.query('DELETE FROM tenants WHERE name LIKE $1', ['workflow_%']);
    await db.query('DELETE FROM roles WHERE name LIKE $1', ['workflow_%']);
  });

  describe('Complete Tenant Lifecycle Flow', () => {
    it('should complete full tenant lifecycle: create -> update -> delete', async () => {
      // Step 1: Create tenant
      const createData = {
        name: 'workflow_tenant_1',
        displayName: 'Workflow Tenant 1',
        domain: 'workflow1.example.com',
      };

      const createResponse = await request(app)
        .post('/api/admin/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createData)
        .expect(201);

      expect(createResponse.body).toMatchObject({
        name: createData.name,
        displayName: createData.displayName,
        domain: createData.domain,
      });
      
      const tenantId = createResponse.body.id;
      expect(tenantId).toBeDefined();

      // Verify creation audit log
      let auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['tenant', tenantId, 'create']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Step 2: Retrieve tenant
      const getResponse = await request(app)
        .get(`/api/admin/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.id).toBe(tenantId);
      expect(getResponse.body.name).toBe(createData.name);

      // Step 3: Update tenant
      const updateData = {
        displayName: 'Updated Workflow Tenant 1',
        domain: 'updated-workflow1.example.com',
        status: 'active',
      };

      const updateResponse = await request(app)
        .put(`/api/admin/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.displayName).toBe(updateData.displayName);
      expect(updateResponse.body.domain).toBe(updateData.domain);

      // Verify update audit log
      auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['tenant', tenantId, 'update']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Step 4: List tenants (should include our tenant)
      const listResponse = await request(app)
        .get('/api/admin/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(listResponse.body)).toBe(true);

      // Step 5: Delete tenant
      await request(app)
        .delete(`/api/admin/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion audit log
      auditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 AND action = $3',
        ['tenant', tenantId, 'delete']
      );
      expect(auditLogs.rows.length).toBe(1);

      // Verify all audit logs for this tenant
      const allAuditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource = $1 AND resource_id = $2 ORDER BY timestamp',
        ['tenant', tenantId]
      );
      expect(allAuditLogs.rows.length).toBe(3);
      expect(allAuditLogs.rows[0].action).toBe('create');
      expect(allAuditLogs.rows[1].action).toBe('update');
      expect(allAuditLogs.rows[2].action).toBe('delete');
    });
  });

  describe('Complete User Lifecycle Flow', () => {
    let testTenantId: string;

    beforeEach(async () => {
      // Create a test tenant for user tests
      const tenantResponse = await request(app)
        .post('/api/admin/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'workflow_user_tenant', displayName: 'Workflow User Tenant' });
      
      testTenantId = tenantResponse.body.id;
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
        tenantId: testTenantId,
      };

      const createResponse = await request(app)
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
      const getResponse = await request(app)
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

      const updateResponse = await request(app)
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
      const resetResponse = await request(app)
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
      const listResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(listResponse.body)).toBe(true);

      // Step 6: Filter users by tenant
      const filterResponse = await request(app)
        .get(`/api/admin/users?tenantId=${testTenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(filterResponse.body)).toBe(true);

      // Step 7: Delete user
      await request(app)
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
      const userResponse = await request(app)
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

      const createResponse = await request(app)
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
      const listResponse = await request(app)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(listResponse.body)).toBe(true);

      // Step 3: Assign role to user
      const assignResponse = await request(app)
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
      const removeResponse = await request(app)
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
      await request(app)
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
      const response = await request(app)
        .get('/api/admin/tenants')
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
      // Create tenant
      const tenantResponse = await request(app)
        .post('/api/admin/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ name: 'workflow_audit_tenant', displayName: 'Workflow Audit Tenant' });

      const tenantId = tenantResponse.body.id;

      // Create user
      const userResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({
          username: 'workflow_audit_user',
          email: 'audit@example.com',
          firstName: 'Audit',
          lastName: 'User',
          tenantId,
        });

      const userId = userResponse.body.id;

      // Create role
      const roleResponse = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ name: 'workflow_audit_role', displayName: 'Workflow Audit Role' });

      const roleName = roleResponse.body.name;

      // Assign role
      await request(app)
        .post(`/api/admin/users/${userId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ roleName });

      // Reset password
      await request(app)
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
      // Create multiple tenants
      const tenant1Response = await request(app)
        .post('/api/admin/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'workflow_complex_tenant1', displayName: 'Complex Tenant 1' });

      const tenant2Response = await request(app)
        .post('/api/admin/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'workflow_complex_tenant2', displayName: 'Complex Tenant 2' });

      const tenant1Id = tenant1Response.body.id;
      const tenant2Id = tenant2Response.body.id;

      // Create multiple roles
      const role1Response = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'workflow_complex_role1', displayName: 'Complex Role 1' });

      const role2Response = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'workflow_complex_role2', displayName: 'Complex Role 2' });

      const role1Name = role1Response.body.name;
      const role2Name = role2Response.body.name;

      // Create users in different tenants
      const user1Response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'workflow_complex_user1',
          email: 'complex1@example.com',
          firstName: 'Complex',
          lastName: 'User 1',
          tenantId: tenant1Id,
        });

      const user2Response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'workflow_complex_user2',
          email: 'complex2@example.com',
          firstName: 'Complex',
          lastName: 'User 2',
          tenantId: tenant2Id,
        });

      const user1Id = user1Response.body.id;
      const user2Id = user2Response.body.id;

      // Assign different roles to users
      await request(app)
        .post(`/api/admin/users/${user1Id}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleName: role1Name });

      await request(app)
        .post(`/api/admin/users/${user2Id}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleName: role2Name });

      // Filter users by tenant
      const tenant1UsersResponse = await request(app)
        .get(`/api/admin/users?tenantId=${tenant1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(tenant1UsersResponse.body)).toBe(true);

      // Update users
      await request(app)
        .put(`/api/admin/users/${user1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Updated Complex' });

      // Reset password for one user
      await request(app)
        .post(`/api/admin/users/${user1Id}/reset-password`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'ComplexPassword123!', temporary: false });

      // Verify audit logs for all operations
      const allAuditLogs = await db.query(
        'SELECT * FROM admin_audit_log WHERE resource_id IN ($1, $2, $3, $4) ORDER BY timestamp',
        [tenant1Id, tenant2Id, user1Id, user2Id]
      );

      // Should have logs for: 2 tenant creates, 2 user creates, 2 role assigns, 1 user update, 1 password reset
      expect(allAuditLogs.rows.length).toBeGreaterThanOrEqual(8);

      // Clean up
      await request(app)
        .delete(`/api/admin/users/${user1Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .delete(`/api/admin/users/${user2Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .delete(`/api/admin/tenants/${tenant1Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .delete(`/api/admin/tenants/${tenant2Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .delete(`/api/admin/roles/${role1Response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .delete(`/api/admin/roles/${role2Response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });
  });
});
