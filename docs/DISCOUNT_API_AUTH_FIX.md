# Discount API Authentication Fix

## Issue
The Discounts List Page was returning a 401 Unauthorized error when attempting to load discounts from the API endpoint `/api/orgadmin/organisations/{id}/discounts/events`.

## Root Cause
The discount service (`packages/orgadmin-events/src/services/discount.service.ts`) was creating its own axios instance with manual token retrieval from `localStorage`:

```typescript
this.api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

This approach was incompatible with the application's authentication system, which uses the `AuthTokenContext` to provide tokens to API calls through the `useApi` hook.

## Solution
Updated `DiscountsListPage.tsx` to use the `useApi` hook directly instead of the custom discount service, following the same pattern used by `EventTypesListPage` and `VenuesListPage`.

### Changes Made

1. **Removed discount service import**:
   ```typescript
   // Before
   import discountService from '../services/discount.service';
   
   // After
   // (removed)
   ```

2. **Updated loadDiscounts function**:
   ```typescript
   // Before
   const data = await discountService.getDiscounts({
     organisationId: organisation.id,
     moduleType: 'events',
   });
   
   // After
   const response = await execute({
     method: 'GET',
     url: `/api/orgadmin/organisations/${organisation.id}/discounts/events`,
   });
   ```

3. **Updated handleToggleStatus function**:
   ```typescript
   // Before
   await discountService.updateDiscount(discount.id, { status: newStatus });
   
   // After
   await execute({
     method: 'PUT',
     url: `/api/orgadmin/discounts/${discount.id}`,
     data: { status: newStatus },
   });
   ```

4. **Updated handleDeleteConfirm function**:
   ```typescript
   // Before
   await discountService.deleteDiscount(deletingDiscount.id);
   
   // After
   await execute({
     method: 'DELETE',
     url: `/api/orgadmin/discounts/${deletingDiscount.id}`,
   });
   ```

## How useApi Works

The `useApi` hook from `@aws-web-framework/orgadmin-core` provides:

1. **Automatic authentication**: Gets the token from `AuthTokenContext` (provided by the shell)
2. **Retry logic**: Automatically retries failed requests with exponential backoff
3. **Error handling**: Consistent error handling across all API calls
4. **Loading states**: Built-in loading and error state management

Example usage:
```typescript
const { execute } = useApi();

const response = await execute({
  method: 'GET',
  url: '/api/orgadmin/organisations/123/discounts/events',
});
```

The hook automatically:
- Retrieves the auth token from context
- Adds `Authorization: Bearer {token}` header
- Sets `Content-Type: application/json` header
- Handles errors and retries

## Backend Verification

The backend route is properly configured with authentication middleware:

```typescript
router.get(
  '/organisations/:organisationId/discounts/:moduleType',
  authenticateToken(),
  async (req: Request, res: Response) => {
    // ... handler code
  }
);
```

## Testing

To verify the fix:
1. Log in to the Org Admin with a user in an organization that has the `entry-discounts` capability
2. Navigate to Events > Discounts
3. The page should load without 401 errors
4. Check browser console for successful API calls

## Future Considerations

The `discount.service.ts` file is now unused by the frontend. Consider:
- Removing it entirely if no other components use it
- Or updating it to accept a token getter function if it needs to be reused elsewhere

## Related Files

- `packages/orgadmin-events/src/pages/DiscountsListPage.tsx` - Updated to use useApi
- `packages/orgadmin-events/src/services/discount.service.ts` - Original service (now unused)
- `packages/orgadmin-core/src/hooks/useApi.ts` - The useApi hook implementation
- `packages/backend/src/routes/discount.routes.ts` - Backend routes with auth middleware
