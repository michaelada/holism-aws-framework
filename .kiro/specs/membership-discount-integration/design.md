# Design Document: Membership Discount Integration

## Overview

This feature extends the existing discount management system to support the Memberships module. The design leverages the current discount infrastructure built for the Events module and adapts it to work seamlessly with membership types. The integration follows a module-scoped approach where discounts are filtered by `moduleType`, allowing the same discount management interface to serve both Events and Memberships contexts.

The core principle is code reuse: the existing discount pages, services, and components will be reused with minimal modifications. The primary changes involve:
1. Adding discount navigation to the Memberships module
2. Adding a `discount_ids` JSONB column to the `membership_types` table
3. Extending membership type forms to include discount selection
4. Implementing discount validation for membership type associations

This approach minimizes development effort while maintaining consistency across modules and ensuring that future discount-related features automatically benefit both Events and Memberships.

## Architecture

### System Components

The integration spans three architectural layers:

**Frontend Layer (React/TypeScript)**
- Memberships module navigation (packages/orgadmin-memberships)
- Reused discount pages from Events module (packages/orgadmin-events)
- Discount selector component (packages/components)
- Membership type forms with discount selection

**Backend Layer (Node.js/Express)**
- Existing discount service (packages/backend/src/services/discount.service.ts)
- Extended membership service (packages/backend/src/services/membership.service.ts)
- Discount validation logic
- REST API endpoints for discounts and membership types

**Data Layer (PostgreSQL)**
- Existing `discounts` table with `module_type` column
- Extended `membership_types` table with `discount_ids` JSONB column
- Foreign key relationships and validation constraints

### Module Scoping Strategy

The discount system uses a `moduleType` field to distinguish between different contexts:
- `moduleType: 'events'` - Discounts created from Events module
- `moduleType: 'memberships'` - Discounts created from Memberships module

When a user navigates to discounts from the Memberships section, the API filters discounts by `moduleType = 'memberships'`. This ensures that each module maintains its own discount namespace while sharing the same underlying infrastructure.

### Data Flow

**Creating a Membership Type with Discounts:**
1. User fills out membership type form and selects discounts
2. Frontend validates discount selection
3. POST request to `/api/orgadmin/membership-types` with `discountIds` array
4. Backend validates each discount ID (exists, belongs to org, correct moduleType)
5. Backend serializes `discountIds` to JSON and stores in `discount_ids` column
6. Response returns created membership type with discount associations

**Displaying Membership Type Discounts:**
1. Frontend fetches membership type data
2. Backend deserializes `discount_ids` JSONB to string array
3. Frontend makes parallel requests to fetch discount details for each ID
4. UI displays discount information (name, type, value)

**Deleting a Discount:**
1. User attempts to delete a discount
2. Backend checks if discount is referenced in any `membership_types.discount_ids`
3. If in use, return 409 error with count of affected membership types
4. If force delete requested, remove discount ID from all affected membership types
5. Delete discount record

## Components and Interfaces

### Frontend Components

**Navigation Integration**
- Location: `packages/orgadmin-memberships/src/index.ts`
- Add "Discounts" submenu item to memberships navigation
- Route: `/memberships/discounts` → DiscountsListPage with `moduleType='memberships'`
- Conditional rendering based on 'entry-discounts' capability

**Reused Discount Pages**
- `DiscountsListPage`: List all discounts with filtering and pagination
- `CreateDiscountPage`: Form for creating new discounts
- `EditDiscountPage`: Form for editing existing discounts
- Modification: Accept `moduleType` prop to determine API endpoints and context

**Discount Selector Component**
- Location: `packages/components/src/components/discount/DiscountSelector.tsx`
- Props: `selectedDiscountIds`, `onChange`, `organisationId`, `moduleType`
- Features: Multi-select, search, display discount details, removable chips
- API: Fetch active discounts filtered by moduleType

**Membership Type Form Extensions**
- `CreateSingleMembershipTypePage`: Add discount selector section
- `CreateGroupMembershipTypePage`: Add discount selector section
- Form state: Include `discountIds: string[]` field
- Validation: Ensure selected discounts exist and are active

**Membership Type Display Components**
- `MembershipTypesListPage`: Add discount count column
- `MembershipTypeDetailsPage`: Add discount details section
- Display: Fetch and show discount names, types, and values
- Error handling: Show "Discount not found" for invalid IDs

### Backend Services

**DiscountService Extensions**
```typescript
// Existing method - no changes needed
async getByOrganisation(
  organisationId: string,
  moduleType?: ModuleType,
  page: number = 1,
  pageSize: number = 50
): Promise<{ discounts: Discount[]; total: number }>

// New method for membership type validation
async getMembershipTypesUsingDiscount(
  discountId: string,
  organisationId: string
): Promise<string[]>

// New method for force delete
async forceDelete(
  discountId: string,
  organisationId: string
): Promise<void>
```

**MembershipService Extensions**
```typescript
interface CreateMembershipTypeDto {
  // ... existing fields
  discountIds?: string[];
}

interface UpdateMembershipTypeDto {
  // ... existing fields
  discountIds?: string[];
}

interface MembershipType {
  // ... existing fields
  discountIds: string[];
}

// New validation method
async validateDiscountIds(
  discountIds: string[],
  organisationId: string
): Promise<ValidationResult>

// Updated methods
async createMembershipType(data: CreateMembershipTypeDto): Promise<MembershipType>
async updateMembershipType(id: string, data: UpdateMembershipTypeDto): Promise<MembershipType>
```

### API Endpoints

**Discount Endpoints (Existing - Extended)**
```
GET    /api/orgadmin/organisations/:organisationId/discounts/:moduleType
POST   /api/orgadmin/discounts
GET    /api/orgadmin/discounts/:id
PUT    /api/orgadmin/discounts/:id
DELETE /api/orgadmin/discounts/:id
DELETE /api/orgadmin/discounts/:id/force
```

**Membership Type Endpoints (Extended)**
```
GET    /api/orgadmin/organisations/:organisationId/membership-types
POST   /api/orgadmin/membership-types (accepts discountIds)
GET    /api/orgadmin/membership-types/:id (returns discountIds)
PUT    /api/orgadmin/membership-types/:id (accepts discountIds)
DELETE /api/orgadmin/membership-types/:id
```

**New Endpoint for Discount Usage Check**
```
GET    /api/orgadmin/discounts/:id/membership-types
Response: { membershipTypeIds: string[], count: number }
```

## Data Models

### Database Schema Changes

**membership_types Table Extension**
```sql
ALTER TABLE membership_types
ADD COLUMN discount_ids JSONB DEFAULT '[]'::jsonb;

-- Index for efficient discount lookup
CREATE INDEX idx_membership_types_discount_ids 
ON membership_types USING GIN (discount_ids);

-- Comment for documentation
COMMENT ON COLUMN membership_types.discount_ids IS 
'Array of discount IDs associated with this membership type';
```

**Existing discounts Table (No Changes)**
```sql
-- Already has module_type column
-- module_type: 'events' | 'memberships' | 'calendar' | 'merchandise' | 'registrations'
```

### TypeScript Interfaces

**MembershipType Interface Extension**
```typescript
export interface MembershipType {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  membershipFormId: string;
  membershipStatus: 'open' | 'closed';
  isRollingMembership: boolean;
  validUntil?: Date;
  numberOfMonths?: number;
  automaticallyApprove: boolean;
  memberLabels: string[];
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  membershipTypeCategory: 'single' | 'group';
  maxPeopleInApplication?: number;
  minPeopleInApplication?: number;
  personTitles?: string[];
  personLabels?: string[][];
  fieldConfiguration?: Record<string, 'common' | 'unique'>;
  discountIds: string[]; // NEW FIELD
  createdAt: Date;
  updatedAt: Date;
}
```

**Discount Validation Result**
```typescript
export interface DiscountValidationResult {
  valid: boolean;
  errors: Array<{
    discountId: string;
    reason: 'not_found' | 'wrong_organisation' | 'wrong_module_type' | 'inactive';
    message: string;
  }>;
}
```

### Data Serialization

**Storing Discount IDs**
```typescript
// Frontend to Backend
const payload = {
  ...membershipTypeData,
  discountIds: ['discount-uuid-1', 'discount-uuid-2']
};

// Backend to Database
const discountIdsJson = JSON.stringify(payload.discountIds);
await db.query(
  'INSERT INTO membership_types (..., discount_ids) VALUES (..., $1)',
  [discountIdsJson]
);
```

**Retrieving Discount IDs**
```typescript
// Database to Backend
const row = await db.query('SELECT * FROM membership_types WHERE id = $1', [id]);
const discountIds = row.discount_ids ? 
  (Array.isArray(row.discount_ids) ? row.discount_ids : JSON.parse(row.discount_ids)) 
  : [];

// Backend to Frontend
return {
  ...membershipType,
  discountIds
};
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Module Type Filtering Consistency

*For any* module type and any organization, when retrieving discounts filtered by that module type, all returned discounts should have that exact moduleType value.

**Validates: Requirements 2.6, 6.3, 6.4**

### Property 2: Module Type Assignment by Context

*For any* discount created from a specific module context (events or memberships), the created discount should have the moduleType corresponding to that context.

**Validates: Requirements 6.2, 6.6, 6.7**

### Property 3: Discount IDs Serialization Round Trip

*For any* membership type with a discountIds array, storing it to the database and then retrieving it should produce an equivalent discountIds array.

**Validates: Requirements 3.5**

### Property 4: Discount ID Existence Validation

*For any* membership type being saved with discountIds, if any discount ID does not exist in the database, the API should reject the request with a validation error.

**Validates: Requirements 9.1**

### Property 5: Discount Organization Ownership Validation

*For any* membership type being saved with discountIds, if any discount ID belongs to a different organization, the API should reject the request with a validation error.

**Validates: Requirements 9.2**

### Property 6: Discount Module Type Validation

*For any* membership type being saved with discountIds, if any discount ID has a moduleType other than 'memberships', the API should reject the request with a validation error.

**Validates: Requirements 9.3**

### Property 7: Validation Error Message Completeness

*For any* discount validation failure, the error message should contain the failing discount ID and the specific reason for failure.

**Validates: Requirements 9.5**

### Property 8: Capability-Based Component Visibility

*For any* organization and any component requiring the 'entry-discounts' capability, the component should be visible if and only if the organization has that capability enabled.

**Validates: Requirements 1.4, 4.7**

### Property 9: Discount Selector Multi-Selection Behavior

*For any* set of selected discounts in the discount selector component, the form data should reflect all selections, each selection should appear as a removable chip, and removing a chip should update the form data accordingly.

**Validates: Requirements 4.4, 4.5, 4.6**

### Property 10: Active Discounts Filtering in Selector

*For any* set of discounts in the database, the discount selector component should display only those discounts that are both active and have the correct moduleType for the current context.

**Validates: Requirements 4.3**

### Property 11: Discount Count Display Accuracy

*For any* membership type displayed in the list page, the discount count column should show a number equal to the length of the membership type's discountIds array.

**Validates: Requirements 5.1**

### Property 12: Discount Details Display Completeness

*For any* membership type with associated discounts, the details page should display all discount information including name, type (percentage or fixed), and value for each discount ID.

**Validates: Requirements 5.2, 5.5**

### Property 13: Discount Details Fetching Behavior

*For any* membership type with discountIds, when displaying the details page, the UI should make API requests to fetch discount details for each discount ID in the array.

**Validates: Requirements 5.4**

### Property 14: Discount Deletion Association Check

*For any* discount being deleted, the API should query the membership_types table to check if the discount ID appears in any discountIds array before proceeding with deletion.

**Validates: Requirements 10.1**

### Property 15: In-Use Discount Deletion Prevention

*For any* discount that is referenced in one or more membership type discountIds arrays, attempting to delete it should return a 409 error indicating the discount is in use.

**Validates: Requirements 10.2**

### Property 16: Deletion Error Message Count Accuracy

*For any* 409 error returned when attempting to delete an in-use discount, the error message should include the count of membership types that reference that discount.

**Validates: Requirements 10.3**

### Property 17: Discount Association Retrieval

*For any* discount ID, the API endpoint for retrieving associated membership types should return all membership types whose discountIds array contains that discount ID.

**Validates: Requirements 10.4**

### Property 18: Force Delete Cleanup Completeness

*For any* discount being force deleted, after the operation completes, no membership type should have that discount ID in its discountIds array, and the discount should no longer exist in the database.

**Validates: Requirements 10.5, 10.6**

### Property 19: Default Empty Array for New Membership Types

*For any* newly created membership type that does not specify discountIds, the discount_ids column should contain an empty JSON array.

**Validates: Requirements 7.3**

### Property 20: Migration Idempotency

*For any* database state, running the discount_ids column migration multiple times should not cause errors, data loss, or duplicate columns.

**Validates: Requirements 7.5**

### Property 21: Migration Data Preservation

*For any* existing membership type record, after running the discount_ids migration, all existing field values should remain unchanged.

**Validates: Requirements 7.6**

### Property 22: API Parameter Acceptance for Create

*For any* valid CreateMembershipTypeDto with a discountIds array, the API should accept the request without parameter-related errors.

**Validates: Requirements 3.3**

### Property 23: API Parameter Acceptance for Update

*For any* valid UpdateMembershipTypeDto with a discountIds array, the API should accept the request without parameter-related errors.

**Validates: Requirements 3.4**

## Error Handling

### Validation Errors

**Discount ID Validation Failures**
- Error Code: 400 Bad Request
- Scenarios:
  - Discount ID does not exist
  - Discount belongs to different organization
  - Discount has wrong moduleType (not 'memberships')
  - Discount is inactive
- Response Format:
```json
{
  "error": "Discount validation failed",
  "details": [
    {
      "discountId": "uuid",
      "reason": "not_found",
      "message": "Discount with ID 'uuid' does not exist"
    }
  ]
}
```

**Empty Discount IDs Array**
- Empty arrays are valid and should be accepted
- No validation error should be thrown for `discountIds: []`

**Invalid JSON in Database**
- If `discount_ids` column contains invalid JSON, service should return empty array
- Log warning for data integrity issue
- Do not throw error to prevent application crashes

### Deletion Errors

**Discount In Use**
- Error Code: 409 Conflict
- Scenario: Attempting to delete discount referenced by membership types
- Response Format:
```json
{
  "error": "Discount is in use",
  "message": "Cannot delete discount. It is associated with 3 membership type(s).",
  "affectedCount": 3,
  "discountId": "uuid"
}
```

**Force Delete**
- Endpoint: `DELETE /api/orgadmin/discounts/:id/force`
- Removes discount from all membership types before deletion
- Returns success even if discount is in use
- Response includes count of cleaned up associations

### Not Found Errors

**Discount Not Found in UI**
- Scenario: Membership type references deleted discount
- UI Behavior: Display "Discount not found" placeholder
- Do not fail entire page render
- Log warning for data integrity issue

**Membership Type Not Found**
- Error Code: 404 Not Found
- Scenario: Attempting to update/delete non-existent membership type
- Response Format:
```json
{
  "error": "Membership type not found",
  "membershipTypeId": "uuid"
}
```

### Capability Errors

**Missing Capability**
- Scenario: Organization does not have 'entry-discounts' capability
- UI Behavior: Hide discount-related UI elements
- API Behavior: Return 403 Forbidden if capability check is enforced
- No error shown to user, features simply not available

### Concurrent Modification

**Optimistic Locking**
- Use `updated_at` timestamp for conflict detection
- If membership type was modified since last fetch, return 409
- Client should refetch and retry with latest data

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of discount association workflows
- Edge cases like empty discount arrays, missing discounts, invalid JSON
- Integration points between membership service and discount service
- UI component rendering with specific discount configurations
- Error message formatting and content

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs (see Correctness Properties section)
- Comprehensive input coverage through randomization
- Validation logic across many discount ID combinations
- Serialization/deserialization round trips
- Module type filtering consistency

### Property-Based Testing Configuration

**Testing Library**: fast-check (JavaScript/TypeScript property-based testing library)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: membership-discount-integration, Property {number}: {property_text}`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Feature: membership-discount-integration, Property 3: Discount IDs Serialization Round Trip', () => {
  it('should preserve discountIds array through save and retrieve cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        async (discountIds) => {
          // Create membership type with discountIds
          const created = await membershipService.createMembershipType({
            ...validMembershipTypeData,
            discountIds
          });
          
          // Retrieve membership type
          const retrieved = await membershipService.getMembershipTypeById(created.id);
          
          // Assert round trip equality
          expect(retrieved.discountIds).toEqual(discountIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Coverage Areas

**Backend Service Tests**
- `membership.service.test.ts`: CRUD operations with discountIds
- `discount.service.test.ts`: Membership type association checks
- `discount-validator.test.ts`: Discount ID validation logic
- Migration tests: Schema changes and data preservation

**Backend API Tests**
- `membership.routes.test.ts`: API endpoints with discountIds parameter
- `discount.routes.test.ts`: Force delete and association retrieval endpoints
- Error response format validation
- Capability-based access control

**Frontend Component Tests**
- `DiscountSelector.test.tsx`: Multi-select behavior, chip display
- `MembershipTypeForm.test.tsx`: Form state with discount selection
- `MembershipTypesListPage.test.tsx`: Discount count display
- `MembershipTypeDetailsPage.test.tsx`: Discount details rendering

**Frontend Integration Tests**
- Navigation flow from memberships to discounts
- Module type context propagation
- Discount selection and form submission workflow
- Error handling and user feedback

### Test Data Generators

**For Property-Based Tests**:
```typescript
// Generate valid discount IDs
const discountIdArb = fc.uuid();

// Generate arrays of discount IDs
const discountIdsArb = fc.array(discountIdArb, { minLength: 0, maxLength: 10 });

// Generate membership type data
const membershipTypeArb = fc.record({
  organisationId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string(),
  discountIds: discountIdsArb,
  // ... other fields
});

// Generate module types
const moduleTypeArb = fc.constantFrom('events', 'memberships');

// Generate discount data
const discountArb = fc.record({
  organisationId: fc.uuid(),
  moduleType: moduleTypeArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  discountType: fc.constantFrom('percentage', 'fixed'),
  discountValue: fc.float({ min: 0, max: 100 }),
  // ... other fields
});
```

### Edge Cases to Test

1. **Empty discount IDs array**: Should be accepted and stored correctly
2. **Null discount_ids column**: Should be treated as empty array
3. **Invalid JSON in discount_ids**: Should return empty array without crashing
4. **Deleted discount referenced**: UI should show "Discount not found"
5. **Discount from wrong organization**: Validation should reject
6. **Discount with wrong moduleType**: Validation should reject
7. **Inactive discount**: Should not appear in selector
8. **Force delete with many associations**: Should clean up all references
9. **Concurrent updates to membership type**: Should handle optimistic locking
10. **Migration on existing data**: Should not modify existing records

### Integration Test Scenarios

1. **End-to-End Discount Association**:
   - Create discount in memberships module
   - Create membership type with that discount
   - Verify discount appears in membership type details
   - Update membership type to remove discount
   - Verify discount no longer appears

2. **Cross-Module Isolation**:
   - Create discount in events module
   - Attempt to associate with membership type
   - Verify validation rejects wrong moduleType

3. **Deletion Workflow**:
   - Create membership type with discounts
   - Attempt to delete associated discount
   - Verify 409 error with correct count
   - Force delete discount
   - Verify membership type no longer references it

4. **Capability-Based Access**:
   - Test with organization having 'entry-discounts' capability
   - Test with organization lacking capability
   - Verify UI elements show/hide correctly

### Performance Considerations

**Database Queries**:
- Use GIN index on `discount_ids` JSONB column for efficient lookups
- Batch fetch discount details to avoid N+1 queries
- Cache discount data in frontend to reduce API calls

**Validation**:
- Validate discount IDs in single query using `WHERE id = ANY($1)`
- Avoid individual queries for each discount ID

**Force Delete**:
- Use single UPDATE query with JSONB operations to remove discount from all membership types
- Wrap in transaction to ensure atomicity

