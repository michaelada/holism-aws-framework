import { AuditLogService, LogAdminActionDto } from '../../services/audit-log.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');

describe('AuditLogService', () => {
  let auditLogService: AuditLogService;
  let mockDb: jest.Mocked<typeof db>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock database
    mockDb = {
      query: jest.fn(),
    } as any;

    // Create service instance
    auditLogService = new AuditLogService(mockDb);
  });

  describe('logAdminAction', () => {
    const logData: LogAdminActionDto = {
      userId: 'user-123',
      action: 'create',
      resource: 'tenant',
      resourceId: 'tenant-456',
      changes: { name: 'New Tenant', displayName: 'New Tenant Display' },
      ipAddress: '192.168.1.100',
    };

    it('should create audit log with all fields', async () => {
      const mockAuditLog = {
        id: 'audit-log-789',
        user_id: logData.userId,
        action: logData.action,
        resource: logData.resource,
        resource_id: logData.resourceId,
        changes: logData.changes,
        ip_address: logData.ipAddress,
        timestamp: new Date(),
      };

      mockDb.query.mockResolvedValue({
        rows: [mockAuditLog],
      } as any);

      const result = await auditLogService.logAdminAction(logData);

      // Verify database insertion
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_audit_log'),
        [
          logData.userId,
          logData.action,
          logData.resource,
          logData.resourceId,
          JSON.stringify(logData.changes),
          logData.ipAddress,
        ]
      );

      // Verify result
      expect(result).toMatchObject({
        id: mockAuditLog.id,
        userId: logData.userId,
        action: logData.action,
        resource: logData.resource,
        resourceId: logData.resourceId,
        changes: logData.changes,
        ipAddress: logData.ipAddress,
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should create audit log without optional fields', async () => {
      const minimalLogData: LogAdminActionDto = {
        userId: 'user-123',
        action: 'delete',
        resource: 'user',
      };

      const mockAuditLog = {
        id: 'audit-log-789',
        user_id: minimalLogData.userId,
        action: minimalLogData.action,
        resource: minimalLogData.resource,
        resource_id: null,
        changes: null,
        ip_address: null,
        timestamp: new Date(),
      };

      mockDb.query.mockResolvedValue({
        rows: [mockAuditLog],
      } as any);

      const result = await auditLogService.logAdminAction(minimalLogData);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_audit_log'),
        [
          minimalLogData.userId,
          minimalLogData.action,
          minimalLogData.resource,
          null,
          null,
          null,
        ]
      );

      expect(result).toMatchObject({
        userId: minimalLogData.userId,
        action: minimalLogData.action,
        resource: minimalLogData.resource,
      });
      expect(result.resourceId).toBeNull();
      expect(result.changes).toBeNull();
      expect(result.ipAddress).toBeNull();
    });

    it('should throw error if database insertion fails', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(auditLogService.logAdminAction(logData)).rejects.toThrow('Database error');
    });

    it('should log different action types', async () => {
      const actions = ['create', 'update', 'delete', 'reset_password', 'assign_role', 'remove_role'];

      for (const action of actions) {
        const logData: LogAdminActionDto = {
          userId: 'user-123',
          action,
          resource: 'user',
          resourceId: 'user-456',
        };

        mockDb.query.mockResolvedValue({
          rows: [{
            id: 'audit-log-789',
            user_id: logData.userId,
            action: logData.action,
            resource: logData.resource,
            resource_id: logData.resourceId,
            changes: null,
            ip_address: null,
            timestamp: new Date(),
          }],
        } as any);

        const result = await auditLogService.logAdminAction(logData);

        expect(result.action).toBe(action);
      }
    });

    it('should log different resource types', async () => {
      const resources = ['tenant', 'user', 'role'];

      for (const resource of resources) {
        const logData: LogAdminActionDto = {
          userId: 'user-123',
          action: 'create',
          resource,
          resourceId: `${resource}-456`,
        };

        mockDb.query.mockResolvedValue({
          rows: [{
            id: 'audit-log-789',
            user_id: logData.userId,
            action: logData.action,
            resource: logData.resource,
            resource_id: logData.resourceId,
            changes: null,
            ip_address: null,
            timestamp: new Date(),
          }],
        } as any);

        const result = await auditLogService.logAdminAction(logData);

        expect(result.resource).toBe(resource);
      }
    });
  });

  describe('extractUserIdFromRequest', () => {
    it('should extract user ID from request and look up database ID', async () => {
      const mockRequest = {
        user: {
          userId: 'keycloak-user-123',
          username: 'testuser',
        },
      } as any;

      mockDb.query.mockResolvedValue({
        rows: [{ id: 'db-user-456' }],
      } as any);

      const userId = await auditLogService.extractUserIdFromRequest(mockRequest);

      expect(userId).toBe('db-user-456');
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE keycloak_user_id = $1',
        ['keycloak-user-123']
      );
    });

    it('should return null if user not found in database', async () => {
      const mockRequest = {
        user: {
          userId: 'keycloak-user-123',
          username: 'testuser',
        },
      } as any;

      mockDb.query.mockResolvedValue({
        rows: [],
      } as any);

      const userId = await auditLogService.extractUserIdFromRequest(mockRequest);

      expect(userId).toBeNull();
    });

    it('should throw error if user is not in request', async () => {
      const mockRequest = {} as any;

      await expect(auditLogService.extractUserIdFromRequest(mockRequest)).rejects.toThrow(
        'User ID not found in request'
      );
    });

    it('should throw error if user ID is missing', async () => {
      const mockRequest = {
        user: {
          username: 'testuser',
        },
      } as any;

      await expect(auditLogService.extractUserIdFromRequest(mockRequest)).rejects.toThrow(
        'User ID not found in request'
      );
    });

    it('should return null if database query fails', async () => {
      const mockRequest = {
        user: {
          userId: 'keycloak-user-123',
          username: 'testuser',
        },
      } as any;

      mockDb.query.mockRejectedValue(new Error('Database error'));

      const userId = await auditLogService.extractUserIdFromRequest(mockRequest);

      expect(userId).toBeNull();
    });
  });

  describe('extractIpAddressFromRequest', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1',
        },
        ip: '127.0.0.1',
      } as any;

      const ipAddress = auditLogService.extractIpAddressFromRequest(mockRequest);

      expect(ipAddress).toBe('192.168.1.100');
    });

    it('should extract IP from X-Forwarded-For header (array)', () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': ['192.168.1.100, 10.0.0.1', '172.16.0.1'],
        },
        ip: '127.0.0.1',
      } as any;

      const ipAddress = auditLogService.extractIpAddressFromRequest(mockRequest);

      expect(ipAddress).toBe('192.168.1.100');
    });

    it('should extract IP from X-Real-IP header', () => {
      const mockRequest = {
        headers: {
          'x-real-ip': '192.168.1.100',
        },
        ip: '127.0.0.1',
      } as any;

      const ipAddress = auditLogService.extractIpAddressFromRequest(mockRequest);

      expect(ipAddress).toBe('192.168.1.100');
    });

    it('should extract IP from X-Real-IP header (array)', () => {
      const mockRequest = {
        headers: {
          'x-real-ip': ['192.168.1.100', '10.0.0.1'],
        },
        ip: '127.0.0.1',
      } as any;

      const ipAddress = auditLogService.extractIpAddressFromRequest(mockRequest);

      expect(ipAddress).toBe('192.168.1.100');
    });

    it('should fall back to req.ip', () => {
      const mockRequest = {
        headers: {},
        ip: '127.0.0.1',
      } as any;

      const ipAddress = auditLogService.extractIpAddressFromRequest(mockRequest);

      expect(ipAddress).toBe('127.0.0.1');
    });

    it('should return "unknown" if no IP is available', () => {
      const mockRequest = {
        headers: {},
      } as any;

      const ipAddress = auditLogService.extractIpAddressFromRequest(mockRequest);

      expect(ipAddress).toBe('unknown');
    });

    it('should prioritize X-Forwarded-For over X-Real-IP', () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'x-real-ip': '10.0.0.1',
        },
        ip: '127.0.0.1',
      } as any;

      const ipAddress = auditLogService.extractIpAddressFromRequest(mockRequest);

      expect(ipAddress).toBe('192.168.1.100');
    });

    it('should prioritize X-Real-IP over req.ip', () => {
      const mockRequest = {
        headers: {
          'x-real-ip': '192.168.1.100',
        },
        ip: '127.0.0.1',
      } as any;

      const ipAddress = auditLogService.extractIpAddressFromRequest(mockRequest);

      expect(ipAddress).toBe('192.168.1.100');
    });
  });

  describe('logAdminActionFromRequest', () => {
    it('should log admin action from request with all data', async () => {
      const mockRequest = {
        user: {
          userId: 'keycloak-user-123',
        },
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
        ip: '127.0.0.1',
      } as any;

      // Mock user lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'db-user-456' }],
      } as any);

      const mockAuditLog = {
        id: 'audit-log-789',
        user_id: 'db-user-456',
        action: 'create',
        resource: 'tenant',
        resource_id: 'tenant-456',
        changes: { name: 'New Tenant' },
        ip_address: '192.168.1.100',
        timestamp: new Date(),
      };

      // Mock audit log insertion
      mockDb.query.mockResolvedValueOnce({
        rows: [mockAuditLog],
      } as any);

      const result = await auditLogService.logAdminActionFromRequest(
        mockRequest,
        'create',
        'tenant',
        'tenant-456',
        { name: 'New Tenant' }
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE keycloak_user_id = $1',
        ['keycloak-user-123']
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_audit_log'),
        [
          'db-user-456',
          'create',
          'tenant',
          'tenant-456',
          JSON.stringify({ name: 'New Tenant' }),
          '192.168.1.100',
        ]
      );

      expect(result).toMatchObject({
        userId: 'db-user-456',
        action: 'create',
        resource: 'tenant',
        resourceId: 'tenant-456',
        ipAddress: '192.168.1.100',
      });
    });

    it('should log admin action from request without optional data', async () => {
      const mockRequest = {
        user: {
          userId: 'keycloak-user-123',
        },
        headers: {},
        ip: '127.0.0.1',
      } as any;

      // Mock user lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'db-user-456' }],
      } as any);

      const mockAuditLog = {
        id: 'audit-log-789',
        user_id: 'db-user-456',
        action: 'delete',
        resource: 'user',
        resource_id: null,
        changes: null,
        ip_address: '127.0.0.1',
        timestamp: new Date(),
      };

      // Mock audit log insertion
      mockDb.query.mockResolvedValueOnce({
        rows: [mockAuditLog],
      } as any);

      const result = await auditLogService.logAdminActionFromRequest(
        mockRequest,
        'delete',
        'user'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE keycloak_user_id = $1',
        ['keycloak-user-123']
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_audit_log'),
        [
          'db-user-456',
          'delete',
          'user',
          null,
          null,
          '127.0.0.1',
        ]
      );

      expect(result).toMatchObject({
        userId: 'db-user-456',
        action: 'delete',
        resource: 'user',
        ipAddress: '127.0.0.1',
      });
    });

    it('should log admin action with undefined userId if user not found in database', async () => {
      const mockRequest = {
        user: {
          userId: 'keycloak-user-123',
        },
        headers: {},
        ip: '127.0.0.1',
      } as any;

      // Mock user lookup returning no results
      mockDb.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      const mockAuditLog = {
        id: 'audit-log-789',
        user_id: null,
        action: 'delete',
        resource: 'user',
        resource_id: null,
        changes: null,
        ip_address: '127.0.0.1',
        timestamp: new Date(),
      };

      // Mock audit log insertion
      mockDb.query.mockResolvedValueOnce({
        rows: [mockAuditLog],
      } as any);

      const result = await auditLogService.logAdminActionFromRequest(
        mockRequest,
        'delete',
        'user'
      );

      expect(result.userId).toBeNull();
    });

    it('should throw error if user ID extraction fails', async () => {
      const mockRequest = {
        headers: {},
        ip: '127.0.0.1',
      } as any;

      await expect(
        auditLogService.logAdminActionFromRequest(mockRequest, 'create', 'tenant')
      ).rejects.toThrow('User ID not found in request');
    });
  });
});
