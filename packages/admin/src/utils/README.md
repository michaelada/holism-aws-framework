# Error Handling Utilities

This directory contains utilities for handling API errors and providing user feedback in the Admin Frontend.

## Overview

The error handling utilities provide a consistent way to:
- Handle API errors with user-friendly messages
- Display success feedback after operations
- Provide retry options for network errors
- Maintain consistent error handling across the application

## Components

### `errorHandling.ts`

Core error handling utilities:

- `handleApiCall()` - Wrapper function for API calls with automatic error handling
- `getErrorMessage()` - Extract user-friendly error messages
- `isRetryableError()` - Check if an error can be retried

### `useApiCall` Hook

Custom React hook that integrates error handling with the notification context:

```typescript
import { useApiCall } from '../hooks/useApiCall';

function MyComponent() {
  const executeApiCall = useApiCall();
  
  const handleSubmit = async (data) => {
    const result = await executeApiCall(
      () => api.createTenant(data),
      {
        successMessage: 'Tenant created successfully',
        errorMessage: 'Failed to create tenant',
      }
    );
    
    if (result.data) {
      // Handle success
    } else if (result.isNetworkError && result.retry) {
      // Show retry dialog
    }
  };
}
```

### `RetryDialog` Component

Dialog component for displaying network error retry options:

```typescript
import { RetryDialog } from '../components/RetryDialog';

<RetryDialog
  open={retryDialog.open}
  message="Unable to load data. Please check your connection."
  onRetry={handleRetry}
  onCancel={handleCancel}
/>
```

## Usage Examples

### Basic API Call with Success/Error Feedback

```typescript
const result = await executeApiCall(
  () => api.getTenants(),
  {
    successMessage: 'Tenants loaded successfully',
    errorMessage: 'Failed to load tenants',
  }
);

if (result.data) {
  setTenants(result.data);
}
```

### API Call with Network Error Retry

```typescript
const result = await executeApiCall(
  () => api.createUser(data),
  {
    successMessage: 'User created successfully',
    errorMessage: 'Failed to create user',
  }
);

if (result.data) {
  // Success - refresh data
  await loadUsers();
} else if (result.isNetworkError && result.retry) {
  // Show retry dialog
  setRetryDialog({
    open: true,
    message: 'Unable to create user. Please check your connection.',
    onRetry: async () => {
      setRetryDialog(prev => ({ ...prev, open: false }));
      await handleSubmit(data);
    },
  });
}
```

### Silent API Call (No Notifications)

```typescript
const result = await executeApiCall(
  () => api.getUsers(),
  {
    showSuccess: false,
    showError: false,
  }
);

if (result.error) {
  // Handle error manually
  console.error('Failed to load users:', result.error);
}
```

### Custom Error Messages

```typescript
const result = await executeApiCall(
  () => api.deleteTenant(id),
  {
    successMessage: 'Tenant deleted successfully',
    errorMessage: 'Cannot delete tenant. It may have active users.',
  }
);
```

## Testing

The error handling utilities are thoroughly tested with property-based tests:

- **Property 25**: Frontend Error Display - Validates that all errors display user-friendly messages
- **Property 26**: Frontend Success Feedback - Validates that successful operations show feedback
- **Property 27**: Network Error Retry Option - Validates that network errors provide retry functionality

Run tests:
```bash
npm test -- src/utils/__tests__
```

## Integration with Existing Code

The TenantsPage has been updated to use the new error handling utilities as a reference implementation. Other pages (UsersPage, RolesPage) can be updated similarly.

### Migration Pattern

Before:
```typescript
try {
  const data = await api.getTenants();
  setTenants(data);
  showSuccess('Tenants loaded');
} catch (error) {
  if (error instanceof ApiError) {
    showError(`Failed: ${error.message}`);
  } else if (error instanceof NetworkError) {
    showError(error.message);
  } else {
    showError('Failed to load tenants');
  }
}
```

After:
```typescript
const result = await executeApiCall(
  () => api.getTenants(),
  {
    successMessage: 'Tenants loaded',
    errorMessage: 'Failed to load tenants',
  }
);

if (result.data) {
  setTenants(result.data);
} else if (result.isNetworkError && result.retry) {
  // Show retry dialog
}
```

## Benefits

1. **Consistency** - All API calls handle errors the same way
2. **Less Boilerplate** - No need for try/catch blocks everywhere
3. **Better UX** - Automatic retry for network errors
4. **Type Safety** - Full TypeScript support
5. **Testability** - Easy to test with property-based tests
