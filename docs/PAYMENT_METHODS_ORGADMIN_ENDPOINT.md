# Payment Methods OrgAdmin Endpoint Implementation

## Issue 1: Empty Payment Methods Dropdown
When creating a single membership type in the orgadmin UI, the "Membership Form" dropdown was empty and the payment methods dropdown was also not loading. The frontend was calling `/api/orgadmin/payment-methods` which returned a 404 error.

### Root Cause
The backend had payment method routes registered at `/api/admin/payment-methods` (for super admin) and organization-specific routes at `/api/admin/organizations/:orgId/payment-methods`, but there was no orgadmin endpoint that would automatically get the authenticated user's organization and return their payment methods.

### Solution
Added a new endpoint `/api/orgadmin/payment-methods` in `packages/backend/src/routes/membership.routes.ts` that:

1. Authenticates the user using the `authenticateToken()` middleware
2. Queries the `organization_users` table to get the user's organization ID
3. Calls `orgPaymentMethodDataService.getOrgPaymentMethods(organisationId)` to fetch payment methods
4. Transforms the response to a simpler format `{ id, name }` that matches what the frontend expects
5. Returns the simplified array to the frontend

## Issue 2: "Organisation ID is required" Error on Save
When trying to save a new membership type, the POST request to `/api/orgadmin/membership-types` was returning `{"error":"Organisation ID is required"}`.

### Root Cause
The `requireMembershipsCapability` middleware expected `organisationId` in either `req.params` or `req.body`, but the frontend doesn't send it. The middleware was checking for the organisation ID before the endpoint could add it from the authenticated user's context.

### Solution
Modified the POST `/membership-types` endpoint to:

1. Remove the `requireMembershipsCapability` middleware
2. Get the user's organisation ID from the `organization_users` table
3. Check the memberships capability directly in the endpoint
4. Add the `organisationId` to the request body before calling the service
5. This follows the same pattern as other orgadmin endpoints like `/api/orgadmin/members`

## Files Modified

### Backend
- `packages/backend/src/routes/membership.routes.ts`
  - Added import for `orgPaymentMethodDataService`
  - Added new GET `/payment-methods` endpoint
  - Modified POST `/membership-types` endpoint to automatically inject organisationId
  - Fixed missing return statements in other endpoints (TypeScript warnings)

## API Endpoints

### GET /api/orgadmin/payment-methods

**Authentication**: Required (Bearer token)

**Description**: Returns all payment methods available to the authenticated user's organization

**Response Format**:
```json
[
  {
    "id": "pay-offline",
    "name": "Pay Offline"
  },
  {
    "id": "stripe",
    "name": "Card Payment (Stripe)"
  }
]
```

**Error Responses**:
- `401`: User not authenticated
- `403`: User is not an organization administrator
- `500`: Failed to fetch payment methods

### POST /api/orgadmin/membership-types

**Authentication**: Required (Bearer token)

**Description**: Creates a new membership type for the authenticated user's organization

**Request Body**: Does NOT require `organisationId` - it's automatically added from the authenticated user's context

**Response Format**:
```json
{
  "id": "membership-type-id",
  "organisationId": "org-id",
  "name": "Adult Membership",
  "description": "...",
  ...
}
```

**Error Responses**:
- `401`: User not authenticated
- `403`: User is not an organization administrator OR organisation does not have memberships capability
- `404`: Organisation not found
- `400`: Validation error (e.g., missing required fields)
- `500`: Failed to create membership type

## Testing
Both endpoints follow the same pattern as other orgadmin endpoints like `/api/orgadmin/members` and `/api/orgadmin/member-filters`, which:
1. Extract the user from the JWT token
2. Query `organization_users` to get the user's organization
3. Return organization-specific data

## Related Issues
This fix completes the work started in the context transfer where:
1. The mock `useApi` hook was replaced with the real one in `CreateSingleMembershipTypePage.tsx` and `CreateGroupMembershipTypePage.tsx`
2. The `/api/orgadmin/application-forms` endpoint was added to fix the empty Membership Form dropdown
3. The `/api/orgadmin/payment-methods` endpoint fixes the empty Payment Methods dropdown
4. The POST `/membership-types` endpoint now automatically injects the organisationId

## Next Steps
The membership type creation form should now work correctly with:
- Both dropdowns populated (Membership Form and Payment Methods)
- Successful save operation without requiring organisationId in the request body
