# Organization Management System Design

## Overview

This document describes the comprehensive design for the multi-tenant organization management system, including Organization Types, Organizations, Capabilities, and User Management integrated with Keycloak.

## Table of Contents

1. [Conceptual Model](#conceptual-model)
2. [User Interface Design](#user-interface-design)
3. [Data Model](#data-model)
4. [Keycloak Integration](#keycloak-integration)
5. [API Design](#api-design)
6. [Implementation Phases](#implementation-phases)

---

## 1. Conceptual Model

### Core Entities

**Organization Type**
- High-level grouping of similar organizations (e.g., "Swimming Clubs", "Tennis Clubs")
- Defines default capabilities, currency, and language for all organizations of this type
- Contains multiple Organizations

**Organization**
- Individual entity using the platform services
- Belongs to one Organization Type
- Has its own data, users, and capability configuration
- Can enable/disable specific capabilities

**Capability**
- Represents a piece of functionality available in the system
- Can be assigned at Organization Type level (defaults) or Organization level (overrides)
- Examples: Event Management, Memberships, Bookings, Merchandise, Discounts, Document Uploads, Event Ticketing

**Organization Admin User**
- User who can manage an organization's data and services
- Assigned specific roles/permissions within their organization
- Managed by Super Admin

**Account User**
- Regular member of an organization who uses services
- Cannot administer/manage the organization
- Managed by Organization Admin Users

**Super Admin**
- Platform administrator with full access
- Manages Organization Types, Organizations, and Organization Admin Users
- Uses the Admin Portal

---

## 2. User Interface Design

### 2.1 Navigation Structure

```
Admin Portal (Super Admin)
├── Dashboard
├── Organization Types
│   ├── List Organization Types
│   ├── Create Organization Type
│   └── Organization Type Details
│       ├── Overview (edit type properties)
│       ├── Organizations (list orgs in this type)
│       └── Default Capabilities
└── System Settings
```

### 2.2 Screen Flows

#### Flow 1: Organization Type Management

**Screen: Organization Types List**
- Table showing all organization types
- Columns: Name, Currency, Language, # of Organizations, Status
- Actions: Create New, Edit, View Organizations

**Screen: Create/Edit Organization Type**
- Form fields:
  - Name (required, unique)
  - Display Name (required)
  - Description (optional)
  - Currency (dropdown: USD, EUR, GBP, AUD, etc.)
  - Language (dropdown: English, Spanish, French, etc.)
  - Default Capabilities (multi-select checklist)
- Capability options:
  - ☐ Event Management
  - ☐ Memberships
  - ☐ Merchandise
  - ☐ Calendar Bookings
  - ☐ Registrations
  - ☐ Discounts
  - ☐ Document Uploads
  - ☐ Event Ticketing
  - ☐ Payment Processing
  - ☐ Email Notifications
- Actions: Save, Cancel

**Screen: Organization Type Details**
- Tabs:
  1. **Overview Tab**: Edit organization type properties (same form as create)
  2. **Organizations Tab**: List of organizations in this type
     - Table columns: Name, Status, # Admin Users, # Account Users, Created Date
     - Actions: Add Organization, Edit Organization, View Details
  3. **Default Capabilities Tab**: Manage default capability list

#### Flow 2: Organization Management (within Organization Type)

**Screen: Organizations List (within Org Type)**
- Breadcrumb: Organization Types > [Type Name] > Organizations
- Table showing organizations in this type
- Columns: Name, Status, Capabilities Count, Admin Users, Account Users, Created Date
- Actions: Add Organization, Edit, View Details
- Filter by: Status (Active/Inactive/Blocked)

**Screen: Create/Edit Organization**
- Breadcrumb: Organization Types > [Type Name] > Organizations > Create/Edit
- Form fields:
  - Organization Name (required, unique)
  - Display Name (required)
  - Domain (optional, for custom URLs)
  - Status (dropdown: Active, Inactive, Blocked)
  - Capabilities (multi-select checklist)
    - Pre-populated with Organization Type defaults
    - User can select subset or keep all
    - Visual indicator showing which are defaults vs custom
- Actions: Save, Cancel

**Screen: Organization Details**
- Breadcrumb: Organization Types > [Type Name] > Organizations > [Org Name]
- Tabs:
  1. **Overview Tab**
     - Organization information (editable)
     - Status indicator
     - Created/Updated dates
     - Statistics: # Admin Users, # Account Users
  
  2. **Capabilities Tab**
     - List of enabled capabilities with toggle switches
     - Visual grouping:
       - Core Services (Events, Memberships, etc.)
       - Additional Features (Discounts, Uploads, etc.)
     - Save button to apply changes
  
  3. **Admin Users Tab**
     - Table of Organization Admin Users
     - Columns: Name, Email, Role, Status, Last Login
     - Actions: Add Admin User, Edit, Remove, Reset Password
  
  4. **Account Users Tab** (Read-only for Super Admin)
     - Summary count of account users
     - Note: "Account users are managed by Organization Admins"

#### Flow 3: Organization Admin User Management

**Screen: Add/Edit Organization Admin User**
- Breadcrumb: Organization Types > [Type Name] > Organizations > [Org Name] > Admin Users > Add/Edit
- Form fields:
  - Email Address (required, used for login)
  - First Name (required)
  - Last Name (required)
  - Organization Admin Role (dropdown)
    - Full Admin (all capabilities)
    - Event Manager (events only)
    - Membership Manager (memberships only)
    - Custom (select specific capabilities)
  - Status (Active/Inactive)
  - Temporary Password (for new users)
  - Send Welcome Email (checkbox)
- If "Custom" role selected:
  - Capability Permissions (multi-select based on org's enabled capabilities)
    - Read/Write/Admin level per capability
- Actions: Save & Send Invite, Save, Cancel

### 2.3 UI Components

**Capability Selector Component**
```
┌─────────────────────────────────────────┐
│ Capabilities                            │
├─────────────────────────────────────────┤
│ Core Services                           │
│ ☑ Event Management          [Default]  │
│ ☑ Memberships               [Default]  │
│ ☐ Merchandise                           │
│ ☑ Calendar Bookings         [Default]  │
│ ☐ Registrations                         │
│                                         │
│ Additional Features                     │
│ ☑ Discounts                 [Default]  │
│ ☐ Document Uploads                      │
│ ☑ Event Ticketing           [Default]  │
│ ☑ Payment Processing        [Default]  │
│ ☐ Email Notifications                   │
└─────────────────────────────────────────┘
```

**Organization Type Card Component**
```
┌─────────────────────────────────────────┐
│ Swimming Clubs                    [Edit]│
│ Currency: USD | Language: English      │
│ 12 Organizations | 45 Admin Users      │
│                                         │
│ Default Capabilities: 8                 │
│ Events, Memberships, Bookings...        │
│                                         │
│ [View Organizations] [Edit Type]        │
└─────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 Database Schema

```sql
-- Organization Types
CREATE TABLE organization_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD', -- ISO 4217 currency code
  language VARCHAR(10) NOT NULL DEFAULT 'en', -- ISO 639-1 language code
  default_capabilities JSONB DEFAULT '[]', -- Array of capability names
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Capabilities (system-wide catalog)
CREATE TABLE capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL, -- e.g., 'event-management'
  display_name VARCHAR(255) NOT NULL, -- e.g., 'Event Management'
  description TEXT,
  category VARCHAR(100), -- 'core-service' or 'additional-feature'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Organizations (replaces tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_type_id UUID REFERENCES organization_types(id) ON DELETE RESTRICT,
  keycloak_group_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'blocked'
  
  -- Inherited from org type but can be overridden
  currency VARCHAR(3),
  language VARCHAR(10),
  
  -- Enabled capabilities (subset of org type defaults)
  enabled_capabilities JSONB DEFAULT '[]',
  
  -- Additional settings
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Organization Users
CREATE TABLE organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  keycloak_user_id VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL, -- 'org-admin' or 'account-user'
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  UNIQUE(organization_id, keycloak_user_id)
);

-- Organization Admin Roles
CREATE TABLE organization_admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  keycloak_role_id VARCHAR(255),
  name VARCHAR(255) NOT NULL, -- e.g., 'full-admin', 'event-manager'
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Capability permissions
  capability_permissions JSONB DEFAULT '{}', 
  -- Format: { "event-management": "admin", "memberships": "read", ... }
  -- Levels: "none", "read", "write", "admin"
  
  is_system_role BOOLEAN DEFAULT false, -- true for predefined roles
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Role Assignments
CREATE TABLE organization_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_user_id UUID REFERENCES organization_users(id) ON DELETE CASCADE,
  organization_admin_role_id UUID REFERENCES organization_admin_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES organization_users(id),
  UNIQUE(organization_user_id, organization_admin_role_id)
);

-- Audit Log
CREATE TABLE organization_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES organization_users(id),
  action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'capability_change'
  entity_type VARCHAR(100) NOT NULL, -- 'organization', 'user', 'role'
  entity_id UUID,
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 TypeScript Types

```typescript
// Organization Type
export interface OrganizationType {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  currency: string; // ISO 4217
  language: string; // ISO 639-1
  defaultCapabilities: string[]; // Array of capability names
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateOrganizationTypeDto {
  name: string;
  displayName: string;
  description?: string;
  currency: string;
  language: string;
  defaultCapabilities: string[];
}

// Capability
export interface Capability {
  id: string;
  name: string; // e.g., 'event-management'
  displayName: string; // e.g., 'Event Management'
  description?: string;
  category: 'core-service' | 'additional-feature';
  isActive: boolean;
  createdAt: string;
}

// Organization
export interface Organization {
  id: string;
  organizationTypeId: string;
  organizationType?: OrganizationType; // Populated in responses
  keycloakGroupId: string;
  name: string;
  displayName: string;
  domain?: string;
  status: 'active' | 'inactive' | 'blocked';
  currency?: string; // Inherits from type if not set
  language?: string; // Inherits from type if not set
  enabledCapabilities: string[];
  settings: Record<string, any>;
  adminUserCount?: number; // Computed field
  accountUserCount?: number; // Computed field
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateOrganizationDto {
  organizationTypeId: string;
  name: string;
  displayName: string;
  domain?: string;
  status?: 'active' | 'inactive' | 'blocked';
  enabledCapabilities: string[];
  currency?: string;
  language?: string;
}

// Organization User
export interface OrganizationUser {
  id: string;
  organizationId: string;
  keycloakUserId: string;
  userType: 'org-admin' | 'account-user';
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive';
  roles?: OrganizationAdminRole[]; // For org-admin users
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CreateOrganizationAdminUserDto {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string; // Organization admin role
  temporaryPassword?: string;
  sendWelcomeEmail?: boolean;
}

// Organization Admin Role
export interface OrganizationAdminRole {
  id: string;
  organizationId: string;
  keycloakRoleId?: string;
  name: string;
  displayName: string;
  description?: string;
  capabilityPermissions: Record<string, PermissionLevel>;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

export interface CreateOrganizationAdminRoleDto {
  name: string;
  displayName: string;
  description?: string;
  capabilityPermissions: Record<string, PermissionLevel>;
}
```

---

## 4. Keycloak Integration

### 4.1 Group Hierarchy

```
Realm: YourApp
├── [Group] Swimming Clubs (Organization Type)
│   ├── [Group] Aquatic Center North (Organization)
│   │   ├── [Subgroup] admins
│   │   │   └── Users: admin@aquatic.com, manager@aquatic.com
│   │   └── [Subgroup] members
│   │       └── Users: member1@aquatic.com, member2@aquatic.com
│   └── [Group] City Swim Club (Organization)
│       ├── [Subgroup] admins
│       └── [Subgroup] members
├── [Group] Tennis Clubs (Organization Type)
│   └── [Group] Metro Tennis Club (Organization)
│       ├── [Subgroup] admins
│       └── [Subgroup] members
```

### 4.2 Realm Roles

**System Roles:**
- `super-admin` - Platform administrator (manages org types and orgs)
- `org-admin` - Organization administrator base role
- `org-member` - Organization member base role

**Predefined Organization Admin Roles:**
- `org-full-admin` - Full access to all capabilities
- `org-event-manager` - Event management only
- `org-membership-manager` - Membership management only
- `org-booking-manager` - Booking management only
- `org-custom` - Custom capability permissions

### 4.3 User Attributes

Each user in Keycloak will have these attributes:

```json
{
  "organizationId": "uuid",
  "organizationTypeId": "uuid",
  "organizationName": "Aquatic Center North",
  "organizationType": "Swimming Clubs",
  "userType": "org-admin",
  "enabledCapabilities": ["event-management", "memberships", "bookings"],
  "capabilityPermissions": {
    "event-management": "admin",
    "memberships": "write",
    "bookings": "read"
  }
}
```

### 4.4 Token Claims

JWT tokens will include:

```json
{
  "sub": "keycloak-user-id",
  "email": "admin@aquatic.com",
  "given_name": "John",
  "family_name": "Doe",
  "groups": [
    "/Swimming Clubs/Aquatic Center North/admins"
  ],
  "realm_access": {
    "roles": ["org-admin", "org-full-admin"]
  },
  "organizationId": "org-uuid",
  "organizationTypeId": "type-uuid",
  "organizationType": "Swimming Clubs",
  "userType": "org-admin",
  "capabilities": ["event-management", "memberships", "bookings"],
  "permissions": {
    "event-management": "admin",
    "memberships": "write",
    "bookings": "read"
  }
}
```

---

## 5. API Design

### 5.1 Organization Type Endpoints

```typescript
// List all organization types
GET /api/admin/organization-types
Response: OrganizationType[]

// Create organization type
POST /api/admin/organization-types
Body: CreateOrganizationTypeDto
Response: OrganizationType

// Get organization type by ID
GET /api/admin/organization-types/:id
Response: OrganizationType

// Update organization type
PUT /api/admin/organization-types/:id
Body: Partial<CreateOrganizationTypeDto>
Response: OrganizationType

// Delete organization type
DELETE /api/admin/organization-types/:id
Response: { success: boolean }

// Get organizations in type
GET /api/admin/organization-types/:id/organizations
Response: Organization[]
```

### 5.2 Capability Endpoints

```typescript
// List all available capabilities
GET /api/admin/capabilities
Response: Capability[]

// Create capability (super admin only)
POST /api/admin/capabilities
Body: { name, displayName, description, category }
Response: Capability
```

### 5.3 Organization Endpoints

```typescript
// List all organizations (with optional type filter)
GET /api/admin/organizations?organizationTypeId=uuid
Response: Organization[]

// Create organization
POST /api/admin/organizations
Body: CreateOrganizationDto
Response: Organization

// Get organization by ID
GET /api/admin/organizations/:id
Response: Organization

// Update organization
PUT /api/admin/organizations/:id
Body: Partial<CreateOrganizationDto>
Response: Organization

// Delete organization
DELETE /api/admin/organizations/:id
Response: { success: boolean }

// Update organization capabilities
PUT /api/admin/organizations/:id/capabilities
Body: { enabledCapabilities: string[] }
Response: Organization

// Get organization statistics
GET /api/admin/organizations/:id/stats
Response: {
  adminUserCount: number,
  accountUserCount: number,
  activeEvents: number,
  totalRevenue: number
}
```

### 5.4 Organization User Endpoints

```typescript
// List organization admin users
GET /api/admin/organizations/:orgId/admin-users
Response: OrganizationUser[]

// Create organization admin user
POST /api/admin/organizations/:orgId/admin-users
Body: CreateOrganizationAdminUserDto
Response: OrganizationUser

// Get admin user by ID
GET /api/admin/organizations/:orgId/admin-users/:userId
Response: OrganizationUser

// Update admin user
PUT /api/admin/organizations/:orgId/admin-users/:userId
Body: Partial<CreateOrganizationAdminUserDto>
Response: OrganizationUser

// Delete admin user
DELETE /api/admin/organizations/:orgId/admin-users/:userId
Response: { success: boolean }

// Reset admin user password
POST /api/admin/organizations/:orgId/admin-users/:userId/reset-password
Body: { temporaryPassword?: string, sendEmail: boolean }
Response: { success: boolean }

// List account users (read-only for super admin)
GET /api/admin/organizations/:orgId/account-users
Response: OrganizationUser[]
```

### 5.5 Organization Admin Role Endpoints

```typescript
// List organization admin roles
GET /api/admin/organizations/:orgId/admin-roles
Response: OrganizationAdminRole[]

// Create custom admin role
POST /api/admin/organizations/:orgId/admin-roles
Body: CreateOrganizationAdminRoleDto
Response: OrganizationAdminRole

// Update admin role
PUT /api/admin/organizations/:orgId/admin-roles/:roleId
Body: Partial<CreateOrganizationAdminRoleDto>
Response: OrganizationAdminRole

// Delete admin role
DELETE /api/admin/organizations/:orgId/admin-roles/:roleId
Response: { success: boolean }

// Assign role to user
POST /api/admin/organizations/:orgId/admin-users/:userId/roles
Body: { roleId: string }
Response: { success: boolean }

// Remove role from user
DELETE /api/admin/organizations/:orgId/admin-users/:userId/roles/:roleId
Response: { success: boolean }
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Database & Backend:**
- [ ] Create database migrations for new schema
- [ ] Update TypeScript types and interfaces
- [ ] Create Capability seed data
- [ ] Implement OrganizationType service and routes
- [ ] Implement Capability service and routes
- [ ] Update Keycloak service for group hierarchy

**Frontend:**
- [ ] Create Organization Type list page
- [ ] Create Organization Type create/edit form
- [ ] Create Capability selector component
- [ ] Update navigation structure

### Phase 2: Organization Management (Week 3-4)

**Database & Backend:**
- [ ] Migrate existing tenants to organizations
- [ ] Implement Organization service with Keycloak integration
- [ ] Create organization-type relationship endpoints
- [ ] Implement capability management for organizations

**Frontend:**
- [ ] Create Organization list page (within org type)
- [ ] Create Organization create/edit form
- [ ] Create Organization details page with tabs
- [ ] Implement capability toggle component
- [ ] Update breadcrumb navigation

### Phase 3: User Management (Week 5-6)

**Database & Backend:**
- [ ] Implement OrganizationUser service
- [ ] Implement OrganizationAdminRole service
- [ ] Create user invitation/email system
- [ ] Implement role assignment logic
- [ ] Update JWT token claims

**Frontend:**
- [ ] Create Admin Users list (within organization)
- [ ] Create Admin User create/edit form
- [ ] Create role selector with capability permissions
- [ ] Implement password reset functionality
- [ ] Create Account Users read-only view

### Phase 4: Testing & Refinement (Week 7-8)

**Testing:**
- [ ] Unit tests for all services
- [ ] Integration tests for Keycloak operations
- [ ] E2E tests for critical user flows
- [ ] Property-based tests for permission logic

**Refinement:**
- [ ] Performance optimization
- [ ] UI/UX improvements based on feedback
- [ ] Documentation updates
- [ ] Migration scripts for existing data

---

## 7. Security Considerations

### 7.1 Access Control

**Super Admin:**
- Full access to all organization types and organizations
- Can create/edit/delete organization types
- Can create/edit/delete organizations
- Can manage organization admin users
- Cannot directly manage account users (delegated to org admins)

**Organization Admin:**
- Access only to their assigned organization
- Permissions based on assigned role and capabilities
- Can manage account users within their organization
- Cannot access other organizations

**Account User:**
- Access only to services within their organization
- Permissions based on organization's enabled capabilities
- Cannot access admin functions

### 7.2 Data Isolation

- Organizations are completely isolated at the data level
- Keycloak groups enforce user-organization boundaries
- Database queries always filter by organizationId
- JWT tokens include organizationId for validation

### 7.3 Audit Trail

- All administrative actions logged in organization_audit_log
- Track who made changes and when
- Store before/after values for updates
- Capability changes specifically tracked

---

## 8. Migration Strategy

### 8.1 Existing Tenant Migration

```sql
-- Step 1: Create default organization type
INSERT INTO organization_types (name, display_name, currency, language, default_capabilities)
VALUES ('General', 'General Organizations', 'USD', 'en', 
  '["event-management", "memberships", "bookings"]'::jsonb);

-- Step 2: Migrate tenants to organizations
INSERT INTO organizations (
  id, organization_type_id, keycloak_group_id, name, display_name, 
  domain, status, enabled_capabilities, created_at, updated_at
)
SELECT 
  t.id,
  (SELECT id FROM organization_types WHERE name = 'General'),
  t.keycloak_group_id,
  t.name,
  t.display_name,
  t.domain,
  t.status,
  '["event-management", "memberships", "bookings"]'::jsonb,
  t.created_at,
  t.updated_at
FROM tenants t;

-- Step 3: Migrate tenant users to organization users
-- (Implementation depends on existing user structure)
```

### 8.2 Keycloak Group Restructuring

1. Create organization type groups in Keycloak
2. Move existing organization groups under appropriate type
3. Create admin/member subgroups within each organization
4. Migrate users to appropriate subgroups
5. Update user attributes with new structure

---

## 9. Example Workflows

### Workflow 1: Super Admin Creates New Organization Type

1. Super Admin logs into Admin Portal
2. Navigates to "Organization Types"
3. Clicks "Create Organization Type"
4. Fills in form:
   - Name: "Swimming Clubs"
   - Currency: USD
   - Language: English
   - Default Capabilities: Events, Memberships, Bookings, Discounts
5. Saves
6. System creates:
   - Database record in organization_types
   - Keycloak group "Swimming Clubs"

### Workflow 2: Super Admin Creates Organization

1. Super Admin navigates to "Swimming Clubs" organization type
2. Clicks "Organizations" tab
3. Clicks "Add Organization"
4. Fills in form:
   - Name: "Aquatic Center North"
   - Status: Active
   - Capabilities: Selects Events, Memberships, Bookings (subset of defaults)
5. Saves
6. System creates:
   - Database record in organizations
   - Keycloak group "Aquatic Center North" under "Swimming Clubs"
   - Subgroups: "admins" and "members"

### Workflow 3: Super Admin Adds Organization Admin User

1. Super Admin navigates to organization details
2. Clicks "Admin Users" tab
3. Clicks "Add Admin User"
4. Fills in form:
   - Email: admin@aquatic.com
   - First Name: John
   - Last Name: Doe
   - Role: Event Manager
5. Checks "Send Welcome Email"
6. Saves
7. System:
   - Creates Keycloak user
   - Adds user to organization's "admins" subgroup
   - Assigns "org-event-manager" role
   - Sets user attributes (organizationId, capabilities, permissions)
   - Creates database record in organization_users
   - Sends welcome email with temporary password

### Workflow 4: Organization Admin Manages Account Users

1. Organization Admin logs into their organization portal
2. Navigates to "Members" section
3. Can add/edit/remove account users
4. System adds users to organization's "members" subgroup
5. Account users can then access enabled services

---

## 10. Future Enhancements

### 10.1 Multi-Organization Users

- Allow users to belong to multiple organizations
- Switch between organizations in UI
- Separate permissions per organization

### 10.2 Organization Hierarchies

- Parent-child organization relationships
- Shared resources between related organizations
- Consolidated reporting

### 10.3 Capability Marketplace

- Third-party capability plugins
- Custom capability development
- Capability versioning and updates

### 10.4 Advanced Role Management

- Role templates
- Role inheritance
- Time-based role assignments
- Approval workflows for role changes

---

## 11. Glossary

- **Organization Type**: High-level category grouping similar organizations
- **Organization**: Individual entity using the platform
- **Capability**: Discrete piece of functionality (e.g., Event Management)
- **Organization Admin User**: User who manages an organization
- **Account User**: Regular member who uses services
- **Super Admin**: Platform administrator
- **Permission Level**: Access level for a capability (none/read/write/admin)

---

## Document Version

- **Version**: 1.0
- **Last Updated**: 2026-02-10
- **Author**: System Design Team
- **Status**: Approved for Implementation
