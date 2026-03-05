# Design Document: Document Management Capability Consolidation

## Overview

This design consolidates three separate document management capabilities (`membership-document-management`, `event-document-management`, `registration-document-management`) into a single unified `document-management` capability. The consolidation simplifies capability management while implementing capability-based visibility for file and image upload field types in the form builder.

The design includes:
- Database migration strategy for capabilities and organization data
- Frontend capability checking in CreateFieldPage and EditFieldPage
- Backend validation to enforce capability requirements
- Rollback support for safe deployment
- Preservation of existing document upload fields

## Architecture

### System Components

The implementation spans three layers:

1. **Database Layer**: PostgreSQL tables for capabilities, organizations, and organization_types
2. **Backend Layer**: Express.js API with capability validation middleware
3. **Frontend Layer**: React components with capability-aware UI rendering

### Data Flow

```
User Action (Create/Edit Field)
    ↓
Frontend: Check capabilities → Filter field types
    ↓
API Request with field data
    ↓
Backend: Validate capability → Allow/Deny operation
    ↓
Database: Store/Update field definition
```

### Migration Strategy

The migration follows a two-phase approach:

**Phase 1: Capability Consolidation**
- Create new `document-management` capability
- Migrate organization capabilities
- Migrate organization type default capabilities
- Remove old capabilities

**Phase 2: Rollback Support**
- Down migration restores original state
- Preserves data integrity during rollback

## Components and Interfaces

### Database Schema Changes

#### Capabilities Table
```sql
-- New capability record
INSERT INTO capabilities (name, display_name, description, category, is_active)
VALUES (
  'document-management',
  'Document Management',
  'Manage document uploads across all modules',
  'additional-feature',
  true
);
```

#### Organizations Table
```sql
-- enabled_capabilities column (existing JSONB array)
-- Migration updates this array for each organization
UPDATE organizations
SET enabled_capabilities = <updated_array>
WHERE <conditions>;
```

#### Organization Types Table
```sql
-- default_capabilities column (existing JSONB array)
-- Migration updates this array for each organization type
UPDATE organization_types
SET default_capabilities = <updated_array>
WHERE <conditions>;
```

### Backend Components

#### Capability Validation Middleware

Location: `packages/backend/src/middleware/field-capability.middleware.ts`

```typescript
export function validateFieldCapability() {
  return async (req: OrganisationRequest, res: Response, next: NextFunction) => {
    const { datatype } = req.body;
    
    // Check if datatype requires document-management capability
    if (datatype === 'file' || datatype === 'image') {
      if (!req.capabilities?.includes('document-management')) {
        return res.status(403).json({
          error: {
            code: 'CAPABILITY_REQUIRED',
            message: 'Document management capability required for file and image fields',
            requiredCapability: 'document-management'
          }
        });
      }
    }
    
    next();
  };
}
```

#### Metadata Routes Enhancement

Location: `packages/backend/src/routes/metadata.routes.ts`

Add capability validation to field creation and update endpoints:

```typescript
// POST /api/metadata/fields
router.post('/fields',
  requireRole('admin'),
  loadOrganisationCapabilities(),
  validateFieldCapability(),
  async (req: Request, res: Response) => {
    // Existing field creation logic
  }
);

// PUT /api/metadata/fields/:shortName
router.put('/fields/:shortName',
  requireRole('admin'),
  loadOrganisationCapabilities(),
  validateFieldCapability(),
  async (req: Request, res: Response) => {
    // Existing field update logic
  }
);
```

### Frontend Components

#### Field Type Filtering Hook

Location: `packages/orgadmin-core/src/forms/hooks/useFilteredFieldTypes.ts`

```typescript
export function useFilteredFieldTypes(): string[] {
  const { hasCapability } = useCapabilities();
  
  const allFieldTypes = [
    'text', 'textarea', 'number', 'email', 'phone',
    'date', 'time', 'datetime', 'boolean',
    'select', 'multiselect', 'radio', 'checkbox',
    'file', 'image'
  ];
  
  return allFieldTypes.filter(type => {
    // Filter out file and image types if capability not present
    if (type === 'file' || type === 'image') {
      return hasCapability('document-management');
    }
    return true;
  });
}
```

#### CreateFieldPage Enhancement

Location: `packages/orgadmin-core/src/forms/pages/CreateFieldPage.tsx`

Replace hardcoded `FIELD_TYPES` array with filtered types:

```typescript
import { useFilteredFieldTypes } from '../hooks/useFilteredFieldTypes';

const CreateFieldPage: React.FC = () => {
  const fieldTypes = useFilteredFieldTypes();
  
  // Use fieldTypes instead of FIELD_TYPES constant
  // Rest of component logic remains the same
};
```

#### EditFieldPage Enhancement

Location: `packages/orgadmin-core/src/forms/pages/EditFieldPage.tsx`

Similar changes as CreateFieldPage:

```typescript
import { useFilteredFieldTypes } from '../hooks/useFilteredFieldTypes';

const EditFieldPage: React.FC = () => {
  const fieldTypes = useFilteredFieldTypes();
  const { hasCapability } = useCapabilities();
  
  // Additional logic for existing document fields
  const canEditDatatype = () => {
    if (originalDatatype === 'file' || originalDatatype === 'image') {
      return hasCapability('document-management');
    }
    return true;
  };
  
  // Use fieldTypes and canEditDatatype in render
};
```

## Data Models

### Capability Model

```typescript
interface Capability {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: 'core-service' | 'additional-feature';
  isActive: boolean;
  createdAt: Date;
}
```

### Organization Model (Relevant Fields)

```typescript
interface Organization {
  id: string;
  enabledCapabilities: string[]; // JSONB array in database
  // ... other fields
}
```

### Organization Type Model (Relevant Fields)

```typescript
interface OrganizationType {
  id: string;
  defaultCapabilities: string[]; // JSONB array in database
  // ... other fields
}
```

### Field Definition Model (Relevant Fields)

```typescript
interface FieldDefinition {
  id?: string;
  shortName: string;
  displayName: string;
  datatype: FieldDatatype; // Includes 'file' and 'image'
  // ... other fields
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Migration Adds New Capability for Any Old Capability

*For any* organization with at least one of the old document management capabilities (`membership-document-management`, `event-document-management`, `registration-document-management`), the migration should add `document-management` to that organization's enabled capabilities.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: Migration Adds New Capability Exactly Once

*For any* organization with one or more old document management capabilities, the migration should add `document-management` exactly once to the organization's enabled capabilities array, regardless of how many old capabilities were present.

**Validates: Requirements 2.4**

### Property 3: Migration Removes All Old Capabilities from Organizations

*For any* organization after migration, the enabled capabilities array should not contain any of the three old document management capability names (`membership-document-management`, `event-document-management`, `registration-document-management`).

**Validates: Requirements 2.5, 2.6, 2.7**

### Property 4: CreateFieldPage Shows Document Types With Capability

*For any* capability set that includes `document-management`, when rendering CreateFieldPage, the field type dropdown should include both `file` and `image` options.

**Validates: Requirements 3.1, 3.2**

### Property 5: CreateFieldPage Hides Document Types Without Capability

*For any* capability set that does not include `document-management`, when rendering CreateFieldPage, the field type dropdown should not include `file` or `image` options.

**Validates: Requirements 3.3, 3.4**

### Property 6: EditFieldPage Shows Document Types With Capability

*For any* capability set that includes `document-management`, when rendering EditFieldPage, the field type dropdown should include both `file` and `image` options.

**Validates: Requirements 3.5, 3.6**

### Property 7: EditFieldPage Hides Document Types Without Capability

*For any* capability set that does not include `document-management`, when rendering EditFieldPage, the field type dropdown should not include `file` or `image` options.

**Validates: Requirements 3.7, 3.8**

### Property 8: Non-Document Field Types Always Visible

*For any* capability set (including empty), when rendering CreateFieldPage or EditFieldPage, all non-document field types (text, number, email, date, etc.) should always be present in the field type dropdown.

**Validates: Requirements 3.9, 3.10**

### Property 9: Backend Rejects Document Fields Without Capability

*For any* organization without `document-management` capability, when attempting to create or update a field with datatype `file` or `image`, the backend should return HTTP 403 with a descriptive error message indicating the missing capability.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.9**

### Property 10: Backend Allows Document Fields With Capability

*For any* organization with `document-management` capability, when creating or updating a field with datatype `file` or `image`, the backend should allow the operation and return success.

**Validates: Requirements 4.5, 4.6, 4.7, 4.8**

### Property 11: Migration Preserves Existing Document Fields

*For any* field definition with datatype `file` or `image` that exists before migration, that field definition should still exist with the same datatype after migration completes.

**Validates: Requirements 5.1, 5.2**

### Property 12: EditFieldPage Allows Full Editing With Capability

*For any* existing document upload field, when the organization has `document-management` capability, the EditFieldPage should allow changing all field properties including the datatype.

**Validates: Requirements 5.4**

### Property 13: Rollback Restores Organization Capabilities

*For any* organization with `document-management` capability, when the down migration executes, that organization should have all three original document management capabilities added to its enabled capabilities array.

**Validates: Requirements 6.5**

### Property 14: Rollback Removes New Capability from Organizations

*For any* organization after down migration, the enabled capabilities array should not contain `document-management`.

**Validates: Requirements 6.6**

### Property 15: Organization Type Inheritance

*For any* organization type with `document-management` in its default capabilities, when a new organization is created with that type, the new organization should have `document-management` in its enabled capabilities.

**Validates: Requirements 7.1**

### Property 16: Migration Updates Organization Type Defaults

*For any* organization type with at least one old document management capability in its default capabilities, the migration should add `document-management` to that organization type's default capabilities.

**Validates: Requirements 7.2**

### Property 17: Migration Removes Old Capabilities from Organization Types

*For any* organization type after migration, the default capabilities array should not contain any of the three old document management capability names.

**Validates: Requirements 7.3, 7.4, 7.5**

## Error Handling

### Frontend Error Handling

1. **Capability Loading Failure**
   - Display error message to user
   - Disable field type selection until capabilities load
   - Provide retry mechanism

2. **API Validation Errors**
   - Display 403 errors with clear messaging about missing capability
   - Guide user to contact administrator for capability enablement

3. **Field Save Failures**
   - Display error message with details
   - Preserve form state for retry
   - Log errors for debugging

### Backend Error Handling

1. **Missing Capability**
   - Return HTTP 403 with structured error response
   - Include required capability name in response
   - Log capability check failures

2. **Migration Errors**
   - Wrap migration in transaction for atomicity
   - Log detailed error information
   - Provide clear rollback instructions

3. **Database Errors**
   - Handle constraint violations gracefully
   - Return appropriate HTTP status codes
   - Log full error details for debugging

### Migration Error Handling

1. **Pre-Migration Validation**
   - Check database connectivity
   - Verify required tables exist
   - Validate data integrity

2. **Transaction Management**
   - Use database transactions for atomic operations
   - Rollback on any error
   - Log transaction state

3. **Post-Migration Verification**
   - Verify capability records created/deleted
   - Verify organization data migrated correctly
   - Run validation queries to confirm state

## Testing Strategy

### Unit Testing

Unit tests will focus on specific components and functions:

1. **Field Type Filtering**
   - Test `useFilteredFieldTypes` hook with various capability sets
   - Verify correct filtering of file/image types
   - Verify non-document types always included

2. **Capability Validation Middleware**
   - Test middleware with various datatype/capability combinations
   - Verify correct HTTP status codes
   - Verify error message format

3. **Component Rendering**
   - Test CreateFieldPage with/without capability
   - Test EditFieldPage with/without capability
   - Test dropdown options match expected values

### Property-Based Testing

Property-based tests will verify universal properties across randomized inputs. Each test will run a minimum of 100 iterations.

**Configuration**: Use `fast-check` library for TypeScript/JavaScript property-based testing.

1. **Migration Properties** (Properties 1-3, 13-14, 16-17)
   - Generate random organization data with various capability combinations
   - Run migration logic
   - Verify properties hold for all generated data
   - Tag: **Feature: document-management-capability-consolidation, Property X: [property text]**

2. **UI Filtering Properties** (Properties 4-8)
   - Generate random capability sets
   - Render components with generated capabilities
   - Verify field type visibility matches expectations
   - Tag: **Feature: document-management-capability-consolidation, Property X: [property text]**

3. **Backend Validation Properties** (Properties 9-10)
   - Generate random organization/capability/datatype combinations
   - Make API requests with generated data
   - Verify response codes and success/failure match expectations
   - Tag: **Feature: document-management-capability-consolidation, Property X: [property text]**

4. **Data Preservation Properties** (Properties 11-12)
   - Generate random field definitions with document datatypes
   - Run migration
   - Verify all fields preserved
   - Tag: **Feature: document-management-capability-consolidation, Property X: [property text]**

5. **Organization Type Properties** (Property 15)
   - Generate random organization types with various default capabilities
   - Create new organizations
   - Verify capability inheritance
   - Tag: **Feature: document-management-capability-consolidation, Property X: [property text]**

### Integration Testing

Integration tests will verify end-to-end workflows:

1. **Migration Integration**
   - Run full migration on test database
   - Verify all data transformations
   - Run rollback and verify restoration

2. **API Integration**
   - Test full field creation flow with capability checks
   - Test field update flow with capability checks
   - Verify error responses for missing capabilities

3. **UI Integration**
   - Test complete user flow from dashboard to field creation
   - Verify capability-based UI changes
   - Test error handling and user feedback

### Example-Based Testing

Specific scenarios that should be tested as examples:

1. **Existing Document Field Without Capability** (Requirement 5.3)
   - Create organization with document field
   - Remove document-management capability
   - Verify EditFieldPage allows viewing but prevents datatype changes

2. **Rollback Capability Creation** (Requirements 6.2, 6.3, 6.4, 6.7)
   - Run down migration
   - Verify three old capabilities created
   - Verify new capability removed

### Test Coverage Goals

- Unit test coverage: >80% for new/modified code
- Property test iterations: Minimum 100 per property
- Integration test coverage: All critical user paths
- Migration testing: Both up and down migrations on realistic data sets

