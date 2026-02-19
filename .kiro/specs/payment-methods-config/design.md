# Design Document: Payment Methods Configuration System

## Overview

This document describes the design for a flexible payment methods configuration system that enables super administrators to configure which payment methods are available to organizations, and provides the foundation for organizations to activate and configure payment provider-specific settings.

The system introduces two new database tables (`payment_methods` and `org_payment_method_data`), three backend services, and UI components for super admin configuration. The design follows existing patterns in the codebase for capabilities management and organization configuration.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Super Admin UI Layer                     │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ CreateOrgPage    │  │ EditOrgPage      │                │
│  │ + PaymentMethod  │  │ + PaymentMethod  │                │
│  │   Selector       │  │   Selector       │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services Layer                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ OrganizationService (Extended)                       │  │
│  │ - createOrganization() + payment methods             │  │
│  │ - updateOrganization() + payment methods             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ PaymentMethod    │  │ OrgPaymentMethodData         │   │
│  │ Service          │  │ Service                      │   │
│  │ - CRUD for       │  │ - Associate payment methods  │   │
│  │   payment_methods│  │ - Manage activation status   │   │
│  │                  │  │ - Store payment_data         │   │
│  └──────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ payment_methods  │  │ org_payment_method_data      │   │
│  │ - id             │  │ - id                         │   │
│  │ - name           │  │ - organization_id (FK)       │   │
│  │ - display_name   │  │ - payment_method_id (FK)     │   │
│  │ - description    │  │ - status                     │   │
│  │ - requires_      │  │ - payment_data (JSONB)       │   │
│  │   activation     │  │ - created_at, updated_at     │   │
│  │ - is_active      │  │                              │   │
│  │ - created_at     │  │ UNIQUE(org_id, pm_id)        │   │
│  │ - updated_at     │  │                              │   │
│  └──────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Design Rationale

1. **Separation of Concerns**: Payment method definitions are separate from organization-specific configurations
2. **Extensibility**: JSONB storage allows different payment providers to store arbitrary configuration without schema changes
3. **Consistency**: Follows existing patterns for capabilities management
4. **Flexibility**: Super admins control which methods are available; org admins will activate them (future scope)

## Components and Interfaces

### Database Schema

#### payment_methods Table

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  requires_activation BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX idx_payment_methods_name ON payment_methods(name);
```

#### org_payment_method_data Table

```sql
CREATE TABLE org_payment_method_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  payment_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, payment_method_id)
);

CREATE INDEX idx_org_payment_method_org ON org_payment_method_data(organization_id);
CREATE INDEX idx_org_payment_method_status ON org_payment_method_data(status);
```

### Backend Types

#### TypeScript Interfaces

```typescript
// packages/backend/src/types/payment-method.types.ts

export interface PaymentMethod {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  requiresActivation: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentMethodDto {
  name: string;
  displayName: string;
  description?: string;
  requiresActivation: boolean;
}

export interface UpdatePaymentMethodDto {
  displayName?: string;
  description?: string;
  requiresActivation?: boolean;
  isActive?: boolean;
}

export type PaymentMethodStatus = 'inactive' | 'active';

export interface OrgPaymentMethodData {
  id: string;
  organizationId: string;
  paymentMethodId: string;
  status: PaymentMethodStatus;
  paymentData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  
  // Populated fields
  paymentMethod?: PaymentMethod;
}

export interface CreateOrgPaymentMethodDataDto {
  organizationId: string;
  paymentMethodId: string;
  status?: PaymentMethodStatus;
  paymentData?: Record<string, any>;
}

export interface UpdateOrgPaymentMethodDataDto {
  status?: PaymentMethodStatus;
  paymentData?: Record<string, any>;
}
```

#### Extended Organization Types

```typescript
// Extension to packages/backend/src/types/organization.types.ts

export interface CreateOrganizationDto {
  // ... existing fields ...
  enabledPaymentMethods?: string[]; // Array of payment method names
}

export interface UpdateOrganizationDto {
  // ... existing fields ...
  enabledPaymentMethods?: string[]; // Array of payment method names
}

export interface Organization {
  // ... existing fields ...
  paymentMethods?: OrgPaymentMethodData[]; // Populated field
}
```

### Backend Services

#### PaymentMethodService

```typescript
// packages/backend/src/services/payment-method.service.ts

export class PaymentMethodService {
  /**
   * Get all active payment methods
   */
  async getAllPaymentMethods(): Promise<PaymentMethod[]>

  /**
   * Get payment method by ID
   */
  async getPaymentMethodById(id: string): Promise<PaymentMethod | null>

  /**
   * Get payment method by name
   */
  async getPaymentMethodByName(name: string): Promise<PaymentMethod | null>

  /**
   * Create payment method (super admin only)
   */
  async createPaymentMethod(data: CreatePaymentMethodDto): Promise<PaymentMethod>

  /**
   * Update payment method
   */
  async updatePaymentMethod(id: string, data: UpdatePaymentMethodDto): Promise<PaymentMethod>

  /**
   * Deactivate payment method
   */
  async deactivatePaymentMethod(id: string): Promise<void>

  /**
   * Validate payment method names exist and are active
   */
  async validatePaymentMethods(names: string[]): Promise<boolean>
}
```

#### OrgPaymentMethodDataService

```typescript
// packages/backend/src/services/org-payment-method-data.service.ts

export class OrgPaymentMethodDataService {
  /**
   * Get all payment method data for an organization
   */
  async getOrgPaymentMethods(organizationId: string): Promise<OrgPaymentMethodData[]>

  /**
   * Get specific payment method data for an organization
   */
  async getOrgPaymentMethod(
    organizationId: string, 
    paymentMethodId: string
  ): Promise<OrgPaymentMethodData | null>

  /**
   * Associate payment method with organization
   */
  async createOrgPaymentMethod(
    data: CreateOrgPaymentMethodDataDto
  ): Promise<OrgPaymentMethodData>

  /**
   * Update organization payment method data
   */
  async updateOrgPaymentMethod(
    organizationId: string,
    paymentMethodId: string,
    data: UpdateOrgPaymentMethodDataDto
  ): Promise<OrgPaymentMethodData>

  /**
   * Remove payment method from organization
   */
  async deleteOrgPaymentMethod(
    organizationId: string, 
    paymentMethodId: string
  ): Promise<void>

  /**
   * Sync organization payment methods based on selected names
   * - Adds new associations
   * - Removes deselected associations
   * - Preserves existing associations
   */
  async syncOrgPaymentMethods(
    organizationId: string,
    paymentMethodNames: string[]
  ): Promise<void>

  /**
   * Initialize default payment methods for new organization
   * - Adds "pay-offline" with status='active'
   */
  async initializeDefaultPaymentMethods(organizationId: string): Promise<void>
}
```

#### Extended OrganizationService

```typescript
// Extension to packages/backend/src/services/organization.service.ts

export class OrganizationService {
  // ... existing methods ...

  /**
   * Create organization with payment methods
   * Extended to handle enabledPaymentMethods
   */
  async createOrganization(
    data: CreateOrganizationDto,
    userId?: string
  ): Promise<Organization> {
    // ... existing organization creation logic ...
    
    // Initialize default payment methods
    await orgPaymentMethodDataService.initializeDefaultPaymentMethods(org.id);
    
    // Sync additional payment methods if provided
    if (data.enabledPaymentMethods && data.enabledPaymentMethods.length > 0) {
      await orgPaymentMethodDataService.syncOrgPaymentMethods(
        org.id,
        data.enabledPaymentMethods
      );
    }
    
    return org;
  }

  /**
   * Update organization with payment methods
   * Extended to handle enabledPaymentMethods
   */
  async updateOrganization(
    id: string,
    data: UpdateOrganizationDto,
    userId?: string
  ): Promise<Organization> {
    // ... existing organization update logic ...
    
    // Sync payment methods if provided
    if (data.enabledPaymentMethods !== undefined) {
      await orgPaymentMethodDataService.syncOrgPaymentMethods(
        id,
        data.enabledPaymentMethods
      );
    }
    
    return org;
  }

  /**
   * Get organization by ID with payment methods
   * Extended to populate payment methods
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    // ... existing logic ...
    
    // Populate payment methods
    const paymentMethods = await orgPaymentMethodDataService.getOrgPaymentMethods(id);
    
    return {
      ...org,
      paymentMethods
    };
  }
}
```

### Frontend Components

#### PaymentMethodSelector Component

```typescript
// packages/admin/src/components/PaymentMethodSelector.tsx

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  selectedPaymentMethods: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  paymentMethods,
  selectedPaymentMethods,
  onChange,
  disabled = false,
}) => {
  // Renders checkboxes for each payment method
  // Shows display name, description
  // Indicates which methods require activation
  // "Pay Offline" is checked by default for new organizations
}
```

#### Integration Points

1. **CreateOrganizationPage**: Add PaymentMethodSelector component
   - Load payment methods via API
   - Initialize with "pay-offline" selected by default
   - Pass selected methods in CreateOrganizationDto

2. **EditOrganizationPage**: Add PaymentMethodSelector component
   - Load current organization payment methods
   - Allow modification of selected methods
   - Pass updated methods in UpdateOrganizationDto

### API Routes

```typescript
// packages/backend/src/routes/payment-method.routes.ts

GET    /api/payment-methods              // Get all active payment methods
GET    /api/payment-methods/:id          // Get payment method by ID
POST   /api/payment-methods              // Create payment method (super admin)
PUT    /api/payment-methods/:id          // Update payment method (super admin)
DELETE /api/payment-methods/:id          // Deactivate payment method (super admin)

// Organization-specific routes
GET    /api/organizations/:orgId/payment-methods              // Get org payment methods
POST   /api/organizations/:orgId/payment-methods              // Add payment method to org
PUT    /api/organizations/:orgId/payment-methods/:methodId    // Update org payment method
DELETE /api/organizations/:orgId/payment-methods/:methodId    // Remove payment method from org
```

## Data Models

### Payment Method Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Payment Method States                     │
└─────────────────────────────────────────────────────────────┘

System-wide (payment_methods.is_active):
  ┌─────────┐
  │ Active  │ ──────────────────────────────────┐
  └─────────┘                                    │
       │                                         │
       │ Super admin deactivates                 │
       ▼                                         │
  ┌─────────┐                                    │
  │Inactive │                                    │
  └─────────┘                                    │
                                                 │
Organization-specific (org_payment_method_data.status):
  ┌──────────┐                                  │
  │ inactive │ ◄────────────────────────────────┘
  └──────────┘         (requires_activation=true)
       │
       │ Org admin activates (future scope)
       ▼
  ┌──────────┐
  │  active  │
  └──────────┘
       ▲
       │
       └──────────────────────────────────────────
         (requires_activation=false, auto-active)
```

### Default Payment Method Initialization

When a new organization is created:

1. System automatically associates "pay-offline" payment method
2. Status is set to 'active' (no activation required)
3. payment_data is initialized as empty object `{}`
4. Additional payment methods selected by super admin are associated with status='inactive'

### Payment Data Structure Examples

```typescript
// Pay Offline - No configuration needed
{
  paymentData: {}
}

// Stripe - Will store Stripe Connect data (future scope)
{
  paymentData: {
    stripeAccountId: "acct_xxxxx",
    stripePublishableKey: "pk_live_xxxxx",
    stripeSecretKey: "sk_live_xxxxx", // Encrypted
    connectedAt: "2024-01-15T10:30:00Z"
  }
}

// Helix-Pay - Provider-specific configuration (future scope)
{
  paymentData: {
    merchantId: "merchant_xxxxx",
    apiKey: "hpay_xxxxx", // Encrypted
    webhookSecret: "whsec_xxxxx", // Encrypted
    environment: "production"
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I've identified the following redundancies:

1. **Requirements 1.2 and 9.6** both test unique payment method names - can be combined
2. **Requirements 2.4 and 9.5** both test unique organization-payment method associations - can be combined
3. **Requirements 2.6, 2.7, and 2.8** can be combined into a single comprehensive property about status initialization
4. **Requirements 3.1, 3.2, and 3.3** can be combined into a single property about default payment method initialization
5. **Requirements 5.3 and 10.3** both test JSON round-trip - can be combined
6. **Requirements 1.3, 1.4, 1.5, 1.6, 1.7** all test data structure fields - can be combined into one property about payment method data completeness
7. **Requirements 2.2 and 2.5** test data structure fields - can be combined into one property about association data completeness

The following properties provide unique validation value and will be included:
- Payment method name uniqueness (combines 1.2, 9.6)
- Payment method data completeness (combines 1.3-1.7)
- Organization-payment method association creation (2.1)
- Association uniqueness (combines 2.4, 9.5)
- Association data completeness (combines 2.2, 2.5)
- Payment data JSON round-trip (combines 2.3, 5.3, 10.3)
- Status initialization based on activation requirements (combines 2.6, 2.7, 2.8)
- Default payment method initialization (combines 3.1, 3.2, 3.3)
- Payment method selection creates association (4.3)
- Payment method deselection removes association (4.4)
- Payment method selection persistence (4.5)
- JSON validation (5.4)
- Organization update synchronization (6.5)
- Foreign key constraints (9.3, 9.4)
- New payment methods availability (10.1, 10.4)
- UI rendering properties (8.4, 8.5)

### Correctness Properties

Property 1: Payment method name uniqueness
*For any* two payment methods, if they have the same name, then creating the second one should fail with a uniqueness constraint violation
**Validates: Requirements 1.2, 9.6**

Property 2: Payment method data completeness
*For any* created payment method, it should have all required fields populated: id, name, displayName, requiresActivation, isActive, createdAt, and updatedAt
**Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**

Property 3: Organization-payment method association creation
*For any* valid organization and payment method, the system should be able to create an association between them
**Validates: Requirements 2.1**

Property 4: Association uniqueness
*For any* organization and payment method, attempting to create a duplicate association should fail with a uniqueness constraint violation
**Validates: Requirements 2.4, 9.5**

Property 5: Association data completeness
*For any* created organization-payment method association, it should have all required fields populated: id, organizationId, paymentMethodId, status, paymentData, createdAt, and updatedAt
**Validates: Requirements 2.2, 2.5**

Property 6: Payment data JSON round-trip
*For any* valid JSON object stored as payment data, retrieving it should return an equivalent object with the same structure and values
**Validates: Requirements 2.3, 5.3, 10.3**

Property 7: Status initialization based on activation requirements
*For any* payment method associated with an organization, if the payment method requires activation, the initial status should be 'inactive'; otherwise, the initial status should be 'active'
**Validates: Requirements 2.6, 2.7, 2.8**

Property 8: Default payment method initialization
*For any* newly created organization, it should automatically have the "pay-offline" payment method associated with status='active' and empty payment data
**Validates: Requirements 3.1, 3.2, 3.3**

Property 9: Payment method selection creates association
*For any* organization and payment method, when a super admin selects that payment method for the organization, an association should be created
**Validates: Requirements 4.3**

Property 10: Payment method deselection removes association
*For any* existing organization-payment method association, when a super admin deselects that payment method, the association should be removed
**Validates: Requirements 4.4**

Property 11: Payment method selection persistence
*For any* organization with selected payment methods, after saving and retrieving the organization, the payment method associations should match the selections
**Validates: Requirements 4.5**

Property 12: JSON validation
*For any* invalid JSON string, attempting to store it as payment data should fail with a validation error
**Validates: Requirements 5.4**

Property 13: Organization update synchronization
*For any* organization update that includes payment method changes, after the update completes, the organization's payment method associations should exactly match the requested payment methods
**Validates: Requirements 6.5**

Property 14: Foreign key constraint on organization_id
*For any* non-existent organization ID, attempting to create a payment method association with that organization ID should fail with a foreign key constraint violation
**Validates: Requirements 9.3**

Property 15: Foreign key constraint on payment_method_id
*For any* non-existent payment method ID, attempting to create an organization association with that payment method ID should fail with a foreign key constraint violation
**Validates: Requirements 9.4**

Property 16: New payment methods availability
*For any* newly inserted payment method with is_active=true, it should immediately appear in the list of available payment methods returned by the API
**Validates: Requirements 10.1, 10.4**

Property 17: UI renders all available payment methods
*For any* set of available payment methods, the PaymentMethodSelector component should render a selectable control for each payment method
**Validates: Requirements 8.4**

Property 18: UI indicates selected payment methods
*For any* set of selected payment methods, the PaymentMethodSelector component should visually indicate which payment methods are selected
**Validates: Requirements 8.5**

## Error Handling

### Service Layer Error Handling

1. **PaymentMethodService**
   - Duplicate name: Throw error with message "Payment method with this name already exists"
   - Not found: Return null for get operations, throw error for update/delete operations
   - Invalid data: Throw validation error with specific field information

2. **OrgPaymentMethodDataService**
   - Duplicate association: Throw error with message "Payment method already associated with organization"
   - Invalid organization ID: Throw foreign key constraint error
   - Invalid payment method ID: Throw foreign key constraint error
   - Invalid JSON: Throw validation error with JSON parsing details
   - Not found: Return null for get operations, throw error for update/delete operations

3. **OrganizationService**
   - Invalid payment method names: Throw error with message "Invalid payment methods: [list]"
   - Payment method validation failure: Throw error with specific validation details
   - Transaction rollback: If payment method association fails during organization creation, rollback entire transaction

### Database Constraint Errors

All database constraint violations should be caught and transformed into user-friendly error messages:

```typescript
try {
  // Database operation
} catch (error) {
  if (error.code === '23505') { // Unique violation
    throw new Error('Duplicate entry detected');
  } else if (error.code === '23503') { // Foreign key violation
    throw new Error('Referenced record does not exist');
  } else if (error.code === '23502') { // Not null violation
    throw new Error('Required field is missing');
  }
  throw error;
}
```

### API Error Responses

```typescript
// 400 Bad Request - Validation errors
{
  error: "Validation failed",
  details: {
    field: "name",
    message: "Payment method name must be unique"
  }
}

// 404 Not Found - Resource not found
{
  error: "Payment method not found",
  id: "uuid"
}

// 409 Conflict - Duplicate resource
{
  error: "Payment method already associated with organization",
  organizationId: "uuid",
  paymentMethodId: "uuid"
}

// 500 Internal Server Error - Unexpected errors
{
  error: "Internal server error",
  message: "An unexpected error occurred"
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Both approaches are complementary and necessary

### Unit Testing Focus

Unit tests should focus on:
- Specific examples of payment method creation and association
- Edge cases like empty payment data, special characters in names
- Error conditions (duplicate names, invalid foreign keys, malformed JSON)
- Integration between services (OrganizationService → OrgPaymentMethodDataService)
- Database constraint enforcement
- API endpoint responses

### Property-Based Testing Configuration

- **Library**: Use `fast-check` for TypeScript/JavaScript property-based testing
- **Iterations**: Minimum 100 iterations per property test
- **Tagging**: Each property test must reference its design document property
- **Tag format**: `// Feature: payment-methods-config, Property {number}: {property_text}`

### Property Test Examples

```typescript
// Feature: payment-methods-config, Property 6: Payment data JSON round-trip
test('payment data round-trip preserves structure', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.jsonValue(), // Generate arbitrary JSON
      async (paymentData) => {
        const orgId = await createTestOrganization();
        const methodId = await createTestPaymentMethod();
        
        // Store payment data
        await orgPaymentMethodDataService.createOrgPaymentMethod({
          organizationId: orgId,
          paymentMethodId: methodId,
          paymentData
        });
        
        // Retrieve payment data
        const retrieved = await orgPaymentMethodDataService.getOrgPaymentMethod(
          orgId,
          methodId
        );
        
        // Should be equivalent
        expect(retrieved.paymentData).toEqual(paymentData);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: payment-methods-config, Property 7: Status initialization
test('status initialization based on activation requirements', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(), // Generate random requiresActivation value
      async (requiresActivation) => {
        const orgId = await createTestOrganization();
        const method = await createTestPaymentMethod({ requiresActivation });
        
        const association = await orgPaymentMethodDataService.createOrgPaymentMethod({
          organizationId: orgId,
          paymentMethodId: method.id
        });
        
        const expectedStatus = requiresActivation ? 'inactive' : 'active';
        expect(association.status).toBe(expectedStatus);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests should verify:
- Complete organization creation flow with payment methods
- Organization update flow with payment method changes
- Payment method synchronization logic
- Database transaction rollback on errors
- API endpoint integration with services

### Test Data Management

- Use database transactions for test isolation
- Clean up test data after each test
- Use factories for generating test objects
- Seed test database with initial payment methods

## Migration Strategy

### Database Migration

```javascript
// packages/backend/migrations/YYYYMMDDHHMMSS_create-payment-methods-tables.js

exports.up = async function(knex) {
  // Create payment_methods table
  await knex.schema.createTable('payment_methods', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.string('display_name', 255).notNullable();
    table.text('description');
    table.boolean('requires_activation').notNullable().defaultTo(false);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index('is_active');
    table.index('name');
  });

  // Create org_payment_method_data table
  await knex.schema.createTable('org_payment_method_data', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable()
      .references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('payment_method_id').notNullable()
      .references('id').inTable('payment_methods').onDelete('CASCADE');
    table.string('status', 50).notNullable().defaultTo('inactive');
    table.jsonb('payment_data').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.unique(['organization_id', 'payment_method_id']);
    table.index('organization_id');
    table.index('status');
  });

  // Seed initial payment methods
  await knex('payment_methods').insert([
    {
      name: 'pay-offline',
      display_name: 'Pay Offline',
      description: 'Payment instructions will be provided in the confirmation email. No card details required.',
      requires_activation: false,
      is_active: true
    },
    {
      name: 'stripe',
      display_name: 'Pay By Card (Stripe)',
      description: 'Accept card payments through Stripe. Requires Stripe Connect activation.',
      requires_activation: true,
      is_active: true
    },
    {
      name: 'helix-pay',
      display_name: 'Pay By Card (Helix-Pay)',
      description: 'Accept card payments through Helix-Pay. Requires account activation.',
      requires_activation: true,
      is_active: true
    }
  ]);
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('org_payment_method_data');
  await knex.schema.dropTableIfExists('payment_methods');
};
```

### Data Migration for Existing Organizations

If there are existing organizations in the system, a separate migration should associate them with the default "pay-offline" payment method:

```javascript
// packages/backend/migrations/YYYYMMDDHHMMSS_associate-existing-orgs-with-pay-offline.js

exports.up = async function(knex) {
  // Get pay-offline payment method ID
  const [payOffline] = await knex('payment_methods')
    .where('name', 'pay-offline')
    .select('id');
  
  if (!payOffline) {
    throw new Error('pay-offline payment method not found');
  }

  // Get all existing organizations
  const organizations = await knex('organizations').select('id');
  
  // Associate each organization with pay-offline
  const associations = organizations.map(org => ({
    organization_id: org.id,
    payment_method_id: payOffline.id,
    status: 'active',
    payment_data: {}
  }));
  
  if (associations.length > 0) {
    await knex('org_payment_method_data').insert(associations);
  }
};

exports.down = async function(knex) {
  // Remove all pay-offline associations
  const [payOffline] = await knex('payment_methods')
    .where('name', 'pay-offline')
    .select('id');
  
  if (payOffline) {
    await knex('org_payment_method_data')
      .where('payment_method_id', payOffline.id)
      .delete();
  }
};
```

## Implementation Notes

### Service Implementation Order

1. **PaymentMethodService**: Implement first as it has no dependencies
2. **OrgPaymentMethodDataService**: Implement second, depends on PaymentMethodService
3. **OrganizationService extensions**: Implement last, depends on OrgPaymentMethodDataService

### Frontend Implementation Order

1. **API client functions**: Add functions to fetch payment methods
2. **PaymentMethodSelector component**: Create reusable component
3. **CreateOrganizationPage integration**: Add payment method selection
4. **EditOrganizationPage integration**: Add payment method editing

### Caching Considerations

- Payment methods change rarely, cache with 10-minute TTL (similar to capabilities)
- Organization payment methods should be cached with organization data
- Invalidate organization cache when payment methods are updated

### Security Considerations

- Only super admins can create/update/delete payment methods
- Only super admins can associate payment methods with organizations
- Payment data should be encrypted at rest (especially API keys)
- Sensitive fields in payment_data should be masked in API responses
- Audit log all payment method configuration changes

### Backward Compatibility and Existing Tests

**CRITICAL**: All existing unit tests must continue to pass after implementation.

- **OrganizationService changes**: Extensions to createOrganization and updateOrganization must be backward compatible
- **Optional payment methods parameter**: The `enabledPaymentMethods` field in DTOs must be optional
- **Default behavior**: If `enabledPaymentMethods` is not provided, only initialize default "pay-offline" method
- **Existing test data**: Tests that create organizations without payment methods should continue to work
- **Mock data**: Update test mocks to include payment methods field where needed
- **Test isolation**: New payment method tests should not interfere with existing organization tests
- **Migration safety**: Migrations must handle existing data without breaking current functionality

Before marking any task complete, run the full test suite to ensure no regressions.

### Future Extensibility

This design provides foundation for:
1. **Org Admin Activation UI**: Organizations can activate payment methods
2. **Stripe Connect Integration**: OAuth flow to connect Stripe accounts
3. **Payment Processing**: Use payment_data to process actual payments
4. **Webhook Handling**: Store webhook secrets in payment_data
5. **Multi-currency Support**: Store currency preferences per payment method
6. **Payment Method Analytics**: Track usage and success rates per method
