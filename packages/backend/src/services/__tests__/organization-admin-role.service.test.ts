import { organizationAdminRoleService } from '../organization-admin-role.service';
import { organizationService } from '../organization.service';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../organization.service');

const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockOrgService = organizationService as jest.Mocked<typeof organizationService>;

describe('OrganizationAdminRoleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRolesByOrganization', () => {
    it('should get all roles for an organization', async () => {
      const mockRoles = [
        {
          id: 'role-1',
          organization_id: 'org-1',
          keycloak_role_id: null,
          name: 'admin',
          display_name: 'Administrator',
          description: 'Full access',
          capability_permissions: { 'event-management': 'admin' },
          is_system_role: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRoles } as any);

      const result = await organizationAdminRoleService.getRolesByOrganization('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('admin');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM organization_admin_roles'),
        ['org-1']
      );
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(
        organizationAdminRoleService.getRolesByOrganization('org-1')
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getRoleById', () => {
    it('should get role by ID', async () => {
      const mockRole = {
        id: 'role-1',
        organization_id: 'org-1',
        keycloak_role_id: null,
        name: 'admin',
        display_name: 'Administrator',
        description: 'Full access',
        capability_permissions: { 'event-management': 'admin' },
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockRole] } as any);

      const result = await organizationAdminRoleService.getRoleById('role-1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('admin');
    });

    it('should return null if role not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await organizationAdminRoleService.getRoleById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getRoleByName', () => {
    it('should get role by name within organization', async () => {
      const mockRole = {
        id: 'role-1',
        organization_id: 'org-1',
        keycloak_role_id: null,
        name: 'admin',
        display_name: 'Administrator',
        description: 'Full access',
        capability_permissions: { 'event-management': 'admin' },
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockRole] } as any);

      const result = await organizationAdminRoleService.getRoleByName('org-1', 'admin');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('admin');
    });

    it('should return null if role not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await organizationAdminRoleService.getRoleByName('org-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createRole', () => {
    it('should create a new role', async () => {
      const mockOrg = {
        id: 'org-1',
        enabledCapabilities: ['event-management', 'memberships']
      };

      mockOrgService.getOrganizationById.mockResolvedValue(mockOrg as any);
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any) // Check existing
        .mockResolvedValueOnce({
          rows: [{
            id: 'role-1',
            organization_id: 'org-1',
            keycloak_role_id: null,
            name: 'manager',
            display_name: 'Manager',
            description: 'Manage events',
            capability_permissions: { 'event-management': 'admin' },
            is_system_role: false,
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as any);

      const result = await organizationAdminRoleService.createRole('org-1', {
        name: 'manager',
        displayName: 'Manager',
        description: 'Manage events',
        capabilityPermissions: { 'event-management': 'admin' }
      });

      expect(result.name).toBe('manager');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO organization_admin_roles'),
        expect.arrayContaining(['org-1', 'manager', 'Manager'])
      );
    });

    it('should throw error if organization not found', async () => {
      mockOrgService.getOrganizationById.mockResolvedValue(null);

      await expect(
        organizationAdminRoleService.createRole('nonexistent', {
          name: 'manager',
          displayName: 'Manager',
          capabilityPermissions: {}
        })
      ).rejects.toThrow('Organization not found');
    });

    it('should throw error if role name already exists', async () => {
      const mockOrg = {
        id: 'org-1',
        enabledCapabilities: ['event-management']
      };

      mockOrgService.getOrganizationById.mockResolvedValue(mockOrg as any);
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'existing-role' }]
      } as any);

      await expect(
        organizationAdminRoleService.createRole('org-1', {
          name: 'admin',
          displayName: 'Administrator',
          capabilityPermissions: {}
        })
      ).rejects.toThrow('Role with this name already exists');
    });

    it('should throw error if capability not enabled', async () => {
      const mockOrg = {
        id: 'org-1',
        enabledCapabilities: ['memberships']
      };

      mockOrgService.getOrganizationById.mockResolvedValue(mockOrg as any);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        organizationAdminRoleService.createRole('org-1', {
          name: 'manager',
          displayName: 'Manager',
          capabilityPermissions: { 'event-management': 'admin' }
        })
      ).rejects.toThrow('Capabilities not enabled for organization');
    });
  });

  describe('updateRole', () => {
    it('should update role details', async () => {
      const existingRole = {
        id: 'role-1',
        organization_id: 'org-1',
        keycloak_role_id: null,
        name: 'manager',
        display_name: 'Manager',
        description: 'Manage events',
        capability_permissions: { 'event-management': 'admin' },
        is_system_role: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      const updatedRole = {
        ...existingRole,
        display_name: 'Event Manager',
        updated_at: new Date()
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [existingRole] } as any)
        .mockResolvedValueOnce({ rows: [updatedRole] } as any);

      const result = await organizationAdminRoleService.updateRole('role-1', {
        displayName: 'Event Manager'
      });

      expect(result.displayName).toBe('Event Manager');
    });

    it('should throw error if role not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        organizationAdminRoleService.updateRole('nonexistent', { displayName: 'New Name' })
      ).rejects.toThrow('Role not found');
    });

    it('should throw error if trying to update system role', async () => {
      const systemRole = {
        id: 'role-1',
        organization_id: 'org-1',
        keycloak_role_id: null,
        name: 'admin',
        display_name: 'Administrator',
        description: 'Full access',
        capability_permissions: {},
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [systemRole] } as any);

      await expect(
        organizationAdminRoleService.updateRole('role-1', { displayName: 'New Name' })
      ).rejects.toThrow('Cannot update system role');
    });
  });

  describe('deleteRole', () => {
    it('should delete role', async () => {
      const mockRole = {
        id: 'role-1',
        organization_id: 'org-1',
        keycloak_role_id: null,
        name: 'manager',
        display_name: 'Manager',
        description: 'Manage events',
        capability_permissions: {},
        is_system_role: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockRole] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await organizationAdminRoleService.deleteRole('role-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM organization_admin_roles'),
        ['role-1']
      );
    });

    it('should throw error if role not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        organizationAdminRoleService.deleteRole('nonexistent')
      ).rejects.toThrow('Role not found');
    });

    it('should throw error if trying to delete system role', async () => {
      const systemRole = {
        id: 'role-1',
        organization_id: 'org-1',
        keycloak_role_id: null,
        name: 'admin',
        display_name: 'Administrator',
        description: 'Full access',
        capability_permissions: {},
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [systemRole] } as any);

      await expect(
        organizationAdminRoleService.deleteRole('role-1')
      ).rejects.toThrow('Cannot delete system role');
    });

    it('should throw error if role is assigned to users', async () => {
      const mockRole = {
        id: 'role-1',
        organization_id: 'org-1',
        keycloak_role_id: null,
        name: 'manager',
        display_name: 'Manager',
        description: 'Manage events',
        capability_permissions: {},
        is_system_role: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockRole] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] } as any);

      await expect(
        organizationAdminRoleService.deleteRole('role-1')
      ).rejects.toThrow('Cannot delete role that is assigned to users');
    });
  });

  describe('getRoleUsers', () => {
    it('should get users assigned to role', async () => {
      const mockAssignments = [
        { organization_user_id: 'user-1' },
        { organization_user_id: 'user-2' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockAssignments } as any);

      const result = await organizationAdminRoleService.getRoleUsers('role-1');

      expect(result).toEqual(['user-1', 'user-2']);
    });
  });

  describe('createDefaultRoles', () => {
    it('should create default admin and viewer roles', async () => {
      const mockOrg = {
        id: 'org-1',
        enabledCapabilities: ['event-management', 'memberships']
      };

      mockOrgService.getOrganizationById.mockResolvedValue(mockOrg as any);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await organizationAdminRoleService.createDefaultRoles('org-1');

      expect(mockDb.query).toHaveBeenCalledTimes(2); // Admin and viewer roles
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO organization_admin_roles'),
        expect.arrayContaining(['org-1', 'admin'])
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO organization_admin_roles'),
        expect.arrayContaining(['org-1', 'viewer'])
      );
    });

    it('should throw error if organization not found', async () => {
      mockOrgService.getOrganizationById.mockResolvedValue(null);

      await expect(
        organizationAdminRoleService.createDefaultRoles('nonexistent')
      ).rejects.toThrow('Organization not found');
    });
  });
});
