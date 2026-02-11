import * as fc from 'fast-check';
import { AuditLogService, LogAdminActionDto } from '../../services/audit-log.service';
import { db } from '../../database/pool';

/**
 * Feature: keycloak-admin-integration, Property 21: Comprehensive Audit Logging
 * 
 * For any administrative action (create, update, delete, role assignment, password reset),
 * the system should create an audit log entry containing user ID, action type, resource type,
 * resource ID, changes made, IP address, and timestamp.
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
 */
describe('Property 21: Comprehensive Audit Logging', () => {
  let auditLogService: AuditLogService;

  // Arbitraries for generating test data
  const userIdArbitrary = fc.uuid();
  
  const actionArbitrary = fc.constantFrom(
    'create',
    'update',
    'delete',
    'reset_password',
    'assign_role',
    'remove_role'
  );
  
  const resourceArbitrary = fc.constantFrom('tenant', 'user', 'role');
  
  const resourceIdArbitrary = fc.option(fc.uuid(), { nil: undefined });
  
  const changesArbitrary = fc.option(
    fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(
        fc.string({ maxLength: 100 }),
        fc.integer(),
        fc.boolean(),
        fc.constant(null)
      )
    ),
    { nil: undefined }
  );
  
  const ipAddressArbitrary = fc.option(
    fc.oneof(
      fc.ipV4(),
      fc.ipV6(),
      fc.constant('unknown')
    ),
    { nil: undefined }
  );

  const auditLogDataArbitrary = fc.record({
    userId: userIdArbitrary,
    action: actionArbitrary,
    resource: resourceArbitrary,
    resourceId: resourceIdArbitrary,
    changes: changesArbitrary,
    ipAddress: ipAddressArbitrary,
  });

  beforeAll(async () => {
    await db.initialize();
  });

  beforeEach(() => {
    auditLogService = new AuditLogService(db);
  });

  afterAll(async () => {
    await db.close();
  });

  test('creates audit log with all required fields for any admin action', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditLogDataArbitrary,
        async (logData: LogAdminActionDto) => {
          // userId is always defined by our arbitrary
          const keycloakUserId = logData.userId!;
          const uniqueUsername = `test-${keycloakUserId.substring(0, 8)}`;
          
          // Create user and get database ID
          const userResult = await db.query(
            `INSERT INTO users (keycloak_user_id, username, email, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (keycloak_user_id) DO UPDATE SET username = EXCLUDED.username
             RETURNING id`,
            [keycloakUserId, uniqueUsername, `${uniqueUsername}@example.com`]
          );
          const dbUserId = userResult.rows[0].id;

          // Use database user ID for audit log
          const auditLogData = {
            ...logData,
            userId: dbUserId,
          };

          const result = await auditLogService.logAdminAction(auditLogData);

          // Property 1: Result must contain user ID
          expect(result.userId).toBe(dbUserId);

          // Property 2: Result must contain action type
          expect(result.action).toBe(logData.action);

          // Property 3: Result must contain resource type
          expect(result.resource).toBe(logData.resource);

          // Property 4: Result must contain resource ID (if provided)
          if (logData.resourceId) {
            expect(result.resourceId).toBe(logData.resourceId);
          }

          // Property 5: Result must contain changes (if provided)
          if (logData.changes) {
            expect(result.changes).toEqual(logData.changes);
          }

          // Property 6: Result must contain IP address (if provided)
          if (logData.ipAddress) {
            expect(result.ipAddress).toBe(logData.ipAddress);
          }

          // Property 7: Result must contain timestamp
          expect(result.timestamp).toBeInstanceOf(Date);

          // Property 8: Result must have an ID
          expect(result.id).toBeDefined();
          expect(typeof result.id).toBe('string');

          // Property 9: Audit log must exist in database
          const auditLogCheck = await db.query(
            'SELECT * FROM admin_audit_log WHERE id = $1',
            [result.id]
          );
          expect(auditLogCheck.rows.length).toBe(1);

          // Clean up
          await db.query('DELETE FROM admin_audit_log WHERE id = $1', [result.id]);
          await db.query('DELETE FROM users WHERE id = $1', [dbUserId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('extracts user ID from request for any valid request', async () => {
    const keycloakUserId = fc.sample(fc.uuid(), 1)[0];
    const uniqueUsername = `test-${keycloakUserId.substring(0, 8)}`;
    
    // Create a user in the database
    const userResult = await db.query(
      `INSERT INTO users (keycloak_user_id, username, email, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (keycloak_user_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [keycloakUserId, uniqueUsername, `${uniqueUsername}@example.com`]
    );
    const dbUserId = userResult.rows[0].id;

    const mockRequest = {
      user: {
        userId: keycloakUserId,
        username: 'test-user',
      },
    } as any;

    const extractedUserId = await auditLogService.extractUserIdFromRequest(mockRequest);

    // Property: Extracted user ID must match the database user ID
    expect(extractedUserId).toBe(dbUserId);

    // Clean up
    await db.query('DELETE FROM users WHERE id = $1', [dbUserId]);
  });

  test('extracts IP address from request headers correctly', () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.ipV4(),
        fc.ipV4(),
        (forwardedIp, realIp, directIp) => {
          // Test X-Forwarded-For priority
          const requestWithForwarded = {
            headers: {
              'x-forwarded-for': `${forwardedIp}, ${realIp}`,
              'x-real-ip': realIp,
            },
            ip: directIp,
          } as any;

          const extractedIp1 = auditLogService.extractIpAddressFromRequest(requestWithForwarded);
          
          // Property: X-Forwarded-For should take priority
          expect(extractedIp1).toBe(forwardedIp);

          // Test X-Real-IP priority over req.ip
          const requestWithRealIp = {
            headers: {
              'x-real-ip': realIp,
            },
            ip: directIp,
          } as any;

          const extractedIp2 = auditLogService.extractIpAddressFromRequest(requestWithRealIp);
          
          // Property: X-Real-IP should take priority over req.ip
          expect(extractedIp2).toBe(realIp);

          // Test fallback to req.ip
          const requestWithDirectIp = {
            headers: {},
            ip: directIp,
          } as any;

          const extractedIp3 = auditLogService.extractIpAddressFromRequest(requestWithDirectIp);
          
          // Property: Should fall back to req.ip
          expect(extractedIp3).toBe(directIp);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('logs admin action from request with extracted user ID and IP', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        actionArbitrary,
        resourceArbitrary,
        resourceIdArbitrary,
        changesArbitrary,
        fc.ipV4(),
        async (keycloakUserId, action, resource, resourceId, changes, ipAddress) => {
          // Create a unique username to avoid conflicts
          const uniqueUsername = `test-${keycloakUserId.substring(0, 8)}`;
          
          // Create a user in the database first
          const userResult = await db.query(
            `INSERT INTO users (keycloak_user_id, username, email, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (keycloak_user_id) DO UPDATE SET username = EXCLUDED.username
             RETURNING id`,
            [keycloakUserId, uniqueUsername, `${uniqueUsername}@example.com`]
          );
          
          const dbUserId = userResult.rows[0].id;

          const mockRequest = {
            user: {
              userId: keycloakUserId,
            },
            headers: {
              'x-forwarded-for': ipAddress,
            },
            ip: '127.0.0.1',
          } as any;

          const result = await auditLogService.logAdminActionFromRequest(
            mockRequest,
            action,
            resource,
            resourceId,
            changes
          );

          // Property 1: User ID must be the database user ID
          expect(result.userId).toBe(dbUserId);

          // Property 2: IP address must be extracted from request
          expect(result.ipAddress).toBe(ipAddress);

          // Property 3: Action must match provided action
          expect(result.action).toBe(action);

          // Property 4: Resource must match provided resource
          expect(result.resource).toBe(resource);

          // Property 5: Audit log must be created in database
          const auditLogCheck = await db.query(
            'SELECT * FROM admin_audit_log WHERE id = $1',
            [result.id]
          );
          expect(auditLogCheck.rows.length).toBe(1);

          // Clean up
          await db.query('DELETE FROM admin_audit_log WHERE id = $1', [result.id]);
          await db.query('DELETE FROM users WHERE id = $1', [dbUserId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('handles all admin action types consistently', async () => {
    const allActions = [
      'create',
      'update',
      'delete',
      'reset_password',
      'assign_role',
      'remove_role',
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom(...allActions),
        resourceArbitrary,
        async (keycloakUserId, action, resource) => {
          // Create a test user first and get database ID
          const uniqueUsername = `test-${keycloakUserId.substring(0, 8)}`;
          
          const userResult = await db.query(
            `INSERT INTO users (keycloak_user_id, username, email, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (keycloak_user_id) DO UPDATE SET username = EXCLUDED.username
             RETURNING id`,
            [keycloakUserId, uniqueUsername, `${uniqueUsername}@example.com`]
          );
          const dbUserId = userResult.rows[0].id;

          const result = await auditLogService.logAdminAction({
            userId: dbUserId,
            action,
            resource,
          });

          // Property: All action types must be logged consistently
          expect(result.action).toBe(action);
          expect(result.resource).toBe(resource);
          expect(result.userId).toBe(dbUserId);

          // Clean up
          await db.query('DELETE FROM admin_audit_log WHERE id = $1', [result.id]);
          await db.query('DELETE FROM users WHERE id = $1', [dbUserId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('handles all resource types consistently', async () => {
    const allResources = ['tenant', 'user', 'role'];

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        actionArbitrary,
        fc.constantFrom(...allResources),
        async (keycloakUserId, action, resource) => {
          // Create a test user first and get database ID
          const uniqueUsername = `test-${keycloakUserId.substring(0, 8)}`;
          
          const userResult = await db.query(
            `INSERT INTO users (keycloak_user_id, username, email, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (keycloak_user_id) DO UPDATE SET username = EXCLUDED.username
             RETURNING id`,
            [keycloakUserId, uniqueUsername, `${uniqueUsername}@example.com`]
          );
          const dbUserId = userResult.rows[0].id;

          const result = await auditLogService.logAdminAction({
            userId: dbUserId,
            action,
            resource,
          });

          // Property: All resource types must be logged consistently
          expect(result.resource).toBe(resource);
          expect(result.action).toBe(action);
          expect(result.userId).toBe(dbUserId);

          // Clean up
          await db.query('DELETE FROM admin_audit_log WHERE id = $1', [result.id]);
          await db.query('DELETE FROM users WHERE id = $1', [dbUserId]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
