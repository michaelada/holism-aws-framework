/**
 * Mock for @keycloak/keycloak-admin-client
 * 
 * This mock is used in tests to avoid importing the actual ES module
 * which causes issues with Jest.
 */

const mockKeycloakAdminClient = jest.fn().mockImplementation(() => ({
  auth: jest.fn(),
  getAccessToken: jest.fn(),
  setAccessToken: jest.fn(),
  users: {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'mock-user-id' }),
    update: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    listGroups: jest.fn().mockResolvedValue([]),
    addToGroup: jest.fn().mockResolvedValue(undefined),
    delFromGroup: jest.fn().mockResolvedValue(undefined),
    listRealmRoleMappings: jest.fn().mockResolvedValue([]),
    addRealmRoleMappings: jest.fn().mockResolvedValue(undefined),
    delRealmRoleMappings: jest.fn().mockResolvedValue(undefined),
  },
  groups: {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'mock-group-id' }),
    update: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    listMembers: jest.fn().mockResolvedValue([]),
  },
  roles: {
    find: jest.fn().mockResolvedValue([]),
    findOneByName: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'mock-role-id', roleName: 'mock-role' }),
    delByName: jest.fn().mockResolvedValue(undefined),
  },
  clients: {
    find: jest.fn().mockResolvedValue([]),
  },
  realms: {
    findOne: jest.fn().mockResolvedValue(null),
  },
}));

// Export as default
export default mockKeycloakAdminClient;
