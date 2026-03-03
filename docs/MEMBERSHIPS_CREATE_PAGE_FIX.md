# Memberships Create Page Blank Screen Fix

## Issue
When navigating to "Create Membership Type" (single or group) from the Memberships module, the page showed a blank screen with the following console error:

```
CreateSingleMembershipTypePage.tsx:277 Uncaught TypeError: applicationForms.map is not a function
```

## Root Cause
The mock `useApi` hook in both `CreateSingleMembershipTypePage.tsx` and `CreateGroupMembershipTypePage.tsx` was returning an object `{ id: '1', ...data }` for all API calls, regardless of the endpoint.

However, the code expected arrays for GET requests to:
- `/api/orgadmin/application-forms` - should return an array of forms
- `/api/orgadmin/payment-methods` - should return an array of payment methods
- `/api/orgadmin/application-forms/:id/fields` - should return an array of form fields

When the code tried to call `.map()` on the response (expecting an array), it failed because the response was an object.

## Solution
Updated the mock `useApi` hook in both files to return appropriate data types based on the URL:

### CreateSingleMembershipTypePage.tsx
```typescript
const useApi = () => ({
  execute: async ({ method, url, data }: { method: string; url: string; data?: any }) => {
    console.log('API call:', method, url, data);
    
    // Mock responses based on URL
    if (url === '/api/orgadmin/application-forms') {
      return []; // Return empty array for forms
    }
    if (url === '/api/orgadmin/payment-methods') {
      return [
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ];
    }
    if (url.startsWith('/api/orgadmin/membership-types/')) {
      return { id: '1', ...data }; // Return object for single membership type
    }
    
    return { id: '1', ...data };
  },
});
```

### CreateGroupMembershipTypePage.tsx
```typescript
const useApi = () => ({
  execute: async ({ method, url, data }: { method: string; url: string; data?: any }) => {
    console.log('API call:', method, url, data);
    
    // Mock responses based on URL
    if (url === '/api/orgadmin/application-forms') {
      return []; // Return empty array for forms
    }
    if (url.startsWith('/api/orgadmin/application-forms/') && url.endsWith('/fields')) {
      return []; // Return empty array for form fields
    }
    if (url === '/api/orgadmin/payment-methods') {
      return [
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ];
    }
    if (url.startsWith('/api/orgadmin/membership-types/')) {
      return { id: '1', ...data }; // Return object for single membership type
    }
    
    return { id: '1', ...data };
  },
});
```

## Changes Made
1. **CreateSingleMembershipTypePage.tsx** - Updated mock `useApi` to return arrays for list endpoints
2. **CreateGroupMembershipTypePage.tsx** - Updated mock `useApi` to return arrays for list endpoints

## Verification
After the fix:
1. Navigate to Memberships module
2. Click on "Membership Types" submenu
3. Click "Create" button and select either "Single" or "Group"
4. The create page should now load without errors
5. The form should display with empty dropdowns for:
   - Membership Form (no forms available yet)
   - Supported Payment Methods (shows Pay Offline and Stripe options)

## Notes
- These are mock implementations that will be replaced with actual API calls once the backend endpoints are implemented
- The mock returns empty arrays for forms since no forms exist yet in the system
- The mock returns default payment methods (Pay Offline and Stripe) for testing purposes
- When real API integration is added, these mock hooks should be replaced with the actual `useApi` hook from `@aws-web-framework/orgadmin-core`

## Related Files
- `packages/orgadmin-memberships/src/pages/CreateSingleMembershipTypePage.tsx`
- `packages/orgadmin-memberships/src/pages/CreateGroupMembershipTypePage.tsx`
