# Keycloak Admin Integration - Design Proposal

## Overview

This design proposes building custom admin screens within the application for managing tenants (organizations), users, and roles, while using Keycloak as the underlying identity and access management system. The application will provide a user-friendly interface that abstracts away Keycloak's complexity while maintaining full integration with its authentication and authorization capabilities.

## Feasibility: YES ✓

This is absolutely possible and is a common pattern. Keycloak provides a comprehensive Admin REST API that allows programmatic management of:
- Realms (can represent tenants/organizations)
- Users
- Roles (realm roles and client roles)
- Groups
- Identity providers
- Client configurations

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Application                     │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │  User Mgmt UI  │  │  Role Mgmt UI  │  │ Tenant Mgmt UI│ │
│  └────────┬───────┘  └────────┬───────┘  └───────┬───────┘ │
│           │                   │                   │          │
│           └───────────────────┴───────────────────┘          │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               │
                               │ REST API Calls
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                      Backend Service                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Keycloak Admin Service Layer               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │   │
│  │  │User Service│  │Role Service│  │Tenant Service│  │   │
│  │  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘  │   │
│  │        │                │                │           │   │
│  │        └────────────────┴────────────────┘           │   │
│  │                         │                            │   │
│  │              Keycloak Admin Client                   │   │
│  │         (keycloak-admin-client npm package)          │   │
│  └──────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼─────────────────────────────┘
                              │
                              │ Admin REST API
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                      Keycloak Server                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │    Realms    │  │    Users     │  │     Roles      │  │
│  │  (Tenants)   │  │              │  │                │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## Design Components

### 1. Multi-Tenancy Model

**Option A: Realm-per-Tenant** (Recommended for strong isolation)
- Each organization gets its own Keycloak realm
- Complete data isolation between tenants
- Independent user bases, roles, and configurations
- Better for B2B SaaS with enterprise customers

**Option B: Single Realm with Groups** (Recommended for simpler scenarios)
- All organizations in one realm
- Use Keycloak Groups to represent organizations
- Use group-based role mappings
- Simpler to manage, shared user pool
- Better for B2C or internal applications

**Recommendation**: Start with Option B (Single Realm with Groups) for simplicity, migrate to Option A if strong isolation is needed.

### 2. Backend Service Layer

#### 2.1 Keycloak Admin Client Setup

```typescript
// src/services/keycloak-admin.service.ts
import KcAdminClient from '@keycloak/keycloak-admin-client';

export class KeycloakAdminService {
  private kcAdminClient: KcAdminClient;
  
  constructor() {
    this.kcAdminClient = new KcAdminClient({
      baseUrl: process.env.KEYCLOAK_URL,
      realmName: process.env.KEYCLOAK_REALM,
    });
  }

  async authenticate() {
    // Authenticate using service account
    await this.kcAdminClient.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
    });
  }

  // Token refresh logic
  async ensureAuthenticated() {
    if (!this.kcAdminClient.accessToken || this.isTokenExpired()) {
      await this.authenticate();
    }
  }
}
```

#### 2.2 Tenant Management Service

```typescript
// src/services/tenant.service.ts
export class TenantService {
  constructor(private kcAdmin: KeycloakAdminService) {}

  async createTenant(tenantData: CreateTenantDto): Promise<Tenant> {
    await this.kcAdmin.ensureAuthenticated();
    
    // Create a group to represent the organization
    const group = await this.kcAdmin.client.groups.create({
      name: tenantData.name,
      attributes: {
        displayName: [tenantData.displayName],
        domain: [tenantData.domain],
        status: ['active'],
        createdAt: [new Date().toISOString()],
      },
    });

    // Create tenant-specific roles
    await this.createTenantRoles(group.id, tenantData.name);

    // Store tenant metadata in your database
    const tenant = await this.db.tenants.create({
      keycloakGroupId: group.id,
      name: tenantData.name,
      displayName: tenantData.displayName,
      domain: tenantData.domain,
    });

    return tenant;
  }

  async getTenants(): Promise<Tenant[]> {
    await this.kcAdmin.ensureAuthenticated();
    
    const groups = await this.kcAdmin.client.groups.find();
    
    // Enrich with data from your database
    const tenants = await Promise.all(
      groups.map(async (group) => {
        const dbTenant = await this.db.tenants.findByKeycloakId(group.id);
        return {
          id: dbTenant.id,
          keycloakGroupId: group.id,
          name: group.name,
          displayName: group.attributes?.displayName?.[0] || group.name,
          memberCount: await this.getTenantMemberCount(group.id),
        };
      })
    );

    return tenants;
  }

  async updateTenant(tenantId: string, updates: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.db.tenants.findById(tenantId);
    await this.kcAdmin.ensureAuthenticated();

    // Update Keycloak group
    await this.kcAdmin.client.groups.update(
      { id: tenant.keycloakGroupId },
      {
        name: updates.name || tenant.name,
        attributes: {
          displayName: [updates.displayName || tenant.displayName],
          domain: [updates.domain || tenant.domain],
        },
      }
    );

    // Update local database
    return await this.db.tenants.update(tenantId, updates);
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const tenant = await this.db.tenants.findById(tenantId);
    await this.kcAdmin.ensureAuthenticated();

    // Delete from Keycloak
    await this.kcAdmin.client.groups.del({ id: tenant.keycloakGroupId });

    // Delete from local database
    await this.db.tenants.delete(tenantId);
  }
}
```

#### 2.3 User Management Service

```typescript
// src/services/user.service.ts
export class UserService {
  constructor(private kcAdmin: KeycloakAdminService) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    await this.kcAdmin.ensureAuthenticated();

    // Create user in Keycloak
    const userId = await this.kcAdmin.client.users.create({
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      enabled: true,
      emailVerified: userData.emailVerified || false,
      attributes: {
        phoneNumber: [userData.phoneNumber || ''],
        department: [userData.department || ''],
      },
    });

    // Set password
    if (userData.password) {
      await this.kcAdmin.client.users.resetPassword({
        id: userId.id,
        credential: {
          temporary: userData.temporaryPassword || false,
          type: 'password',
          value: userData.password,
        },
      });
    }

    // Add user to tenant group
    if (userData.tenantId) {
      const tenant = await this.db.tenants.findById(userData.tenantId);
      await this.kcAdmin.client.users.addToGroup({
        id: userId.id,
        groupId: tenant.keycloakGroupId,
      });
    }

    // Assign roles
    if (userData.roles && userData.roles.length > 0) {
      await this.assignRolesToUser(userId.id, userData.roles);
    }

    // Store additional metadata in your database
    const user = await this.db.users.create({
      keycloakUserId: userId.id,
      tenantId: userData.tenantId,
      username: userData.username,
      email: userData.email,
    });

    return user;
  }

  async getUsers(filters?: UserFilters): Promise<User[]> {
    await this.kcAdmin.ensureAuthenticated();

    let users = await this.kcAdmin.client.users.find({
      max: filters?.limit || 100,
      first: filters?.offset || 0,
      search: filters?.search,
      email: filters?.email,
    });

    // Filter by tenant if specified
    if (filters?.tenantId) {
      const tenant = await this.db.tenants.findById(filters.tenantId);
      const groupMembers = await this.kcAdmin.client.groups.listMembers({
        id: tenant.keycloakGroupId,
      });
      const memberIds = new Set(groupMembers.map(m => m.id));
      users = users.filter(u => memberIds.has(u.id));
    }

    // Enrich with local data
    return Promise.all(
      users.map(async (kcUser) => {
        const dbUser = await this.db.users.findByKeycloakId(kcUser.id);
        const roles = await this.getUserRoles(kcUser.id);
        const groups = await this.getUserGroups(kcUser.id);

        return {
          id: dbUser?.id,
          keycloakUserId: kcUser.id,
          username: kcUser.username,
          email: kcUser.email,
          firstName: kcUser.firstName,
          lastName: kcUser.lastName,
          enabled: kcUser.enabled,
          emailVerified: kcUser.emailVerified,
          roles: roles.map(r => r.name),
          tenants: groups.map(g => g.name),
          createdAt: kcUser.createdTimestamp,
        };
      })
    );
  }

  async updateUser(userId: string, updates: UpdateUserDto): Promise<User> {
    const user = await this.db.users.findById(userId);
    await this.kcAdmin.ensureAuthenticated();

    // Update in Keycloak
    await this.kcAdmin.client.users.update(
      { id: user.keycloakUserId },
      {
        email: updates.email,
        firstName: updates.firstName,
        lastName: updates.lastName,
        enabled: updates.enabled,
        attributes: {
          phoneNumber: [updates.phoneNumber || ''],
          department: [updates.department || ''],
        },
      }
    );

    // Update roles if provided
    if (updates.roles) {
      await this.updateUserRoles(user.keycloakUserId, updates.roles);
    }

    // Update tenant membership if provided
    if (updates.tenantId) {
      await this.updateUserTenant(user.keycloakUserId, updates.tenantId);
    }

    // Update local database
    return await this.db.users.update(userId, updates);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.db.users.findById(userId);
    await this.kcAdmin.ensureAuthenticated();

    // Delete from Keycloak
    await this.kcAdmin.client.users.del({ id: user.keycloakUserId });

    // Delete from local database
    await this.db.users.delete(userId);
  }

  async resetPassword(userId: string, newPassword: string, temporary: boolean = false): Promise<void> {
    const user = await this.db.users.findById(userId);
    await this.kcAdmin.ensureAuthenticated();

    await this.kcAdmin.client.users.resetPassword({
      id: user.keycloakUserId,
      credential: {
        temporary,
        type: 'password',
        value: newPassword,
      },
    });
  }
}
```

#### 2.4 Role Management Service

```typescript
// src/services/role.service.ts
export class RoleService {
  constructor(private kcAdmin: KeycloakAdminService) {}

  async createRole(roleData: CreateRoleDto): Promise<Role> {
    await this.kcAdmin.ensureAuthenticated();

    // Create realm role
    await this.kcAdmin.client.roles.create({
      name: roleData.name,
      description: roleData.description,
      attributes: {
        displayName: [roleData.displayName],
        permissions: roleData.permissions || [],
      },
    });

    // Store in local database
    const role = await this.db.roles.create({
      name: roleData.name,
      displayName: roleData.displayName,
      description: roleData.description,
      permissions: roleData.permissions,
    });

    return role;
  }

  async getRoles(): Promise<Role[]> {
    await this.kcAdmin.ensureAuthenticated();

    const kcRoles = await this.kcAdmin.client.roles.find();

    return kcRoles.map(kcRole => ({
      id: kcRole.id,
      name: kcRole.name,
      description: kcRole.description,
      displayName: kcRole.attributes?.displayName?.[0] || kcRole.name,
      composite: kcRole.composite,
    }));
  }

  async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    const user = await this.db.users.findById(userId);
    await this.kcAdmin.ensureAuthenticated();

    const role = await this.kcAdmin.client.roles.findOneByName({ name: roleName });
    
    await this.kcAdmin.client.users.addRealmRoleMappings({
      id: user.keycloakUserId,
      roles: [{ id: role.id, name: role.name }],
    });
  }

  async removeRoleFromUser(userId: string, roleName: string): Promise<void> {
    const user = await this.db.users.findById(userId);
    await this.kcAdmin.ensureAuthenticated();

    const role = await this.kcAdmin.client.roles.findOneByName({ name: roleName });
    
    await this.kcAdmin.client.users.delRealmRoleMappings({
      id: user.keycloakUserId,
      roles: [{ id: role.id, name: role.name }],
    });
  }
}
```

### 3. REST API Endpoints

```typescript
// Backend API routes
POST   /api/admin/tenants              - Create tenant
GET    /api/admin/tenants              - List tenants
GET    /api/admin/tenants/:id          - Get tenant details
PUT    /api/admin/tenants/:id          - Update tenant
DELETE /api/admin/tenants/:id          - Delete tenant

POST   /api/admin/users                - Create user
GET    /api/admin/users                - List users (with filters)
GET    /api/admin/users/:id            - Get user details
PUT    /api/admin/users/:id            - Update user
DELETE /api/admin/users/:id            - Delete user
POST   /api/admin/users/:id/reset-password - Reset user password
POST   /api/admin/users/:id/roles      - Assign role to user
DELETE /api/admin/users/:id/roles/:roleId - Remove role from user

POST   /api/admin/roles                - Create role
GET    /api/admin/roles                - List roles
GET    /api/admin/roles/:id            - Get role details
PUT    /api/admin/roles/:id            - Update role
DELETE /api/admin/roles/:id            - Delete role
```

### 4. Frontend Admin UI

#### 4.1 Page Structure

```
/admin
  /tenants
    /list          - List all tenants
    /create        - Create new tenant
    /:id/edit      - Edit tenant
    /:id/users     - View tenant users
  /users
    /list          - List all users
    /create        - Create new user
    /:id/edit      - Edit user
    /:id/roles     - Manage user roles
  /roles
    /list          - List all roles
    /create        - Create new role
    /:id/edit      - Edit role
    /:id/users     - View users with this role
```

#### 4.2 Component Examples

```typescript
// TenantListPage.tsx
export function TenantListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    const response = await adminApi.getTenants();
    setTenants(response.data);
  };

  const handleDelete = async (tenantId: string) => {
    if (confirm('Delete this tenant? All users will be removed.')) {
      await adminApi.deleteTenant(tenantId);
      fetchTenants();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Tenants / Organizations</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/tenants/create')}
        >
          Create Tenant
        </Button>
      </Box>

      <MetadataTable
        columns={[
          { field: 'name', headerName: 'Name' },
          { field: 'displayName', headerName: 'Display Name' },
          { field: 'domain', headerName: 'Domain' },
          { field: 'memberCount', headerName: 'Users' },
          { field: 'status', headerName: 'Status' },
        ]}
        data={tenants}
        onEdit={(tenant) => navigate(`/admin/tenants/${tenant.id}/edit`)}
        onDelete={handleDelete}
      />
    </Box>
  );
}

// UserListPage.tsx
export function UserListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<UserFilters>({});

  const fetchUsers = async () => {
    const response = await adminApi.getUsers(filters);
    setUsers(response.data);
  };

  return (
    <Box>
      <Typography variant="h4">User Management</Typography>
      
      <Box sx={{ display: 'flex', gap: 2, my: 3 }}>
        <TextField
          label="Search"
          value={filters.search || ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <Select
          label="Tenant"
          value={filters.tenantId || ''}
          onChange={(e) => setFilters({ ...filters, tenantId: e.target.value })}
        >
          <MenuItem value="">All Tenants</MenuItem>
          {/* Tenant options */}
        </Select>
        <Button variant="contained" onClick={fetchUsers}>
          Search
        </Button>
      </Box>

      <MetadataTable
        columns={[
          { field: 'username', headerName: 'Username' },
          { field: 'email', headerName: 'Email' },
          { field: 'firstName', headerName: 'First Name' },
          { field: 'lastName', headerName: 'Last Name' },
          { field: 'tenants', headerName: 'Organizations' },
          { field: 'roles', headerName: 'Roles' },
          { field: 'enabled', headerName: 'Status' },
        ]}
        data={users}
        onEdit={(user) => navigate(`/admin/users/${user.id}/edit`)}
      />
    </Box>
  );
}
```

### 5. Security Considerations

#### 5.1 Admin Service Account

Create a dedicated Keycloak client for admin operations:

```yaml
# Keycloak Client Configuration
Client ID: aws-framework-admin
Client Protocol: openid-connect
Access Type: confidential
Service Accounts Enabled: true
Authorization Enabled: false

# Assign admin roles to service account
Service Account Roles:
  - realm-management: realm-admin
  - realm-management: manage-users
  - realm-management: manage-clients
  - realm-management: view-users
```

#### 5.2 Authorization

Protect admin endpoints with role-based access control:

```typescript
// Middleware to check admin role
export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = jwt.decode(token);
  
  if (!decoded.realm_access?.roles?.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden: Admin role required' });
  }
  
  next();
}

// Apply to admin routes
router.use('/api/admin/*', requireAdminRole);
```

#### 5.3 Audit Logging

Log all admin operations:

```typescript
export async function logAdminAction(action: AdminAction) {
  await db.auditLog.create({
    userId: action.userId,
    action: action.type, // 'CREATE_USER', 'DELETE_TENANT', etc.
    resource: action.resource,
    resourceId: action.resourceId,
    changes: action.changes,
    timestamp: new Date(),
    ipAddress: action.ipAddress,
  });
}
```

### 6. Database Schema

Store additional metadata not in Keycloak:

```sql
-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_group_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (supplementary data)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_user_id VARCHAR(255) UNIQUE NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  preferences JSONB DEFAULT '{}',
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles table (supplementary data)
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_role_id VARCHAR(255) UNIQUE,
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 7. Implementation Phases

**Phase 1: Foundation** (1-2 weeks)
- Set up Keycloak Admin Client
- Create admin service account
- Implement basic authentication for admin endpoints
- Create database schema

**Phase 2: User Management** (1-2 weeks)
- Implement user CRUD operations
- Build user list and detail pages
- Add password reset functionality
- Implement user search and filtering

**Phase 3: Role Management** (1 week)
- Implement role CRUD operations
- Build role assignment UI
- Create role list and detail pages

**Phase 4: Tenant Management** (1-2 weeks)
- Implement tenant CRUD operations
- Build tenant list and detail pages
- Implement tenant-user associations
- Add tenant switching for users

**Phase 5: Polish & Security** (1 week)
- Add audit logging
- Implement comprehensive error handling
- Add input validation
- Security review and testing

### 8. NPM Packages Required

```json
{
  "dependencies": {
    "@keycloak/keycloak-admin-client": "^23.0.0",
    "keycloak-js": "^23.0.0"
  }
}
```

### 9. Benefits of This Approach

✅ **User-Friendly**: Custom UI tailored to your application's look and feel
✅ **Integrated**: Seamlessly integrated with your existing application
✅ **Flexible**: Add custom fields and workflows not available in Keycloak admin
✅ **Branded**: Maintain consistent branding across all admin functions
✅ **Auditable**: Full control over audit logging and compliance
✅ **Extensible**: Easy to add custom features and integrations
✅ **Secure**: Leverage Keycloak's security while controlling access

### 10. Limitations & Considerations

⚠️ **Complexity**: Requires maintaining sync between your DB and Keycloak
⚠️ **API Changes**: Keycloak Admin API may change between versions
⚠️ **Performance**: Additional API calls to Keycloak for each operation
⚠️ **Maintenance**: Need to handle Keycloak upgrades carefully
⚠️ **Fallback**: Should still provide access to Keycloak admin console for advanced features

### 11. Alternative: Keycloak Admin UI Embedding

If you want less custom code, you can embed Keycloak's admin console:

```typescript
// Embed Keycloak admin console in iframe
<iframe
  src={`${KEYCLOAK_URL}/admin/${REALM}/console`}
  style={{ width: '100%', height: '100vh', border: 'none' }}
/>
```

However, this loses the benefits of custom branding and integration.

## Conclusion

**Yes, this is absolutely doable and recommended!** The custom admin UI approach provides the best user experience while maintaining full integration with Keycloak's robust authentication and authorization system. The Keycloak Admin REST API is comprehensive and well-documented, making this a proven pattern used by many enterprise applications.

The key is to use Keycloak as the source of truth for authentication/authorization data while storing supplementary application-specific data in your own database. This gives you the best of both worlds: Keycloak's security expertise and your application's custom requirements.
