# Super Admin Dark Overlay Fix

## Problem
When logging into the super admin UI, a dark shadow/backdrop appears over the screen, blocking the ability to click buttons.

## Root Cause
This is likely caused by a MUI Dialog/Modal backdrop that's stuck in the DOM. Common causes:
1. A dialog that was opened but not properly closed
2. React state management issue causing backdrop to persist
3. Z-index stacking context issue
4. Unmounted component leaving backdrop behind

## Immediate Workaround (Browser Console)

Open browser developer tools (F12) and run this in the console:

```javascript
// Remove all MUI backdrops
document.querySelectorAll('.MuiBackdrop-root').forEach(el => el.remove());

// Or hide them
document.querySelectorAll('.MuiBackdrop-root').forEach(el => el.style.display = 'none');
```

## Investigation Steps

1. **Check for stuck dialogs:**
   ```javascript
   // In browser console
   document.querySelectorAll('[role="dialog"]')
   document.querySelectorAll('.MuiDialog-root')
   ```

2. **Check backdrop elements:**
   ```javascript
   document.querySelectorAll('.MuiBackdrop-root')
   ```

3. **Check z-index issues:**
   ```javascript
   // Find elements with high z-index
   Array.from(document.querySelectorAll('*')).filter(el => {
     const z = window.getComputedStyle(el).zIndex;
     return z !== 'auto' && parseInt(z) > 1000;
   }).map(el => ({element: el, zIndex: window.getComputedStyle(el).zIndex}))
   ```

## Potential Code Fixes

### Fix 1: Add Backdrop Cleanup in App.tsx

Add a useEffect to clean up any stuck backdrops on mount:

```typescript
// In packages/admin/src/App.tsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Clean up any stuck backdrops on mount
    const backdrops = document.querySelectorAll('.MuiBackdrop-root');
    backdrops.forEach(backdrop => backdrop.remove());
  }, []);

  // ... rest of component
}
```

### Fix 2: Check Dialog State Management

Review all Dialog components in:
- `packages/admin/src/pages/OrganizationDetailsPage.tsx`
- `packages/admin/src/components/UserList.tsx`
- `packages/admin/src/components/RoleList.tsx`
- `packages/admin/src/components/RetryDialog.tsx`
- `packages/admin/src/components/PasswordResetDialog.tsx`

Ensure all dialogs have proper:
- `open` prop controlled by state
- `onClose` handler that sets state to false
- Cleanup in useEffect when component unmounts

### Fix 3: Add Global CSS Override

Add to `packages/admin/src/index.css` or theme:

```css
/* Prevent stuck backdrops */
.MuiBackdrop-root {
  pointer-events: auto !important;
}

/* Or hide orphaned backdrops */
.MuiBackdrop-root:not([aria-hidden="false"]) {
  display: none !important;
}
```

### Fix 4: Check for Keycloak Login Redirect Issues

The backdrop might be from the Keycloak login flow. Check:
- `packages/admin/src/context/AuthContext.tsx`
- Ensure Keycloak initialization completes properly
- Check for race conditions during auth redirect

## Testing

After applying fixes:

1. Clear browser cache and local storage
2. Log out completely
3. Close all browser tabs
4. Log in fresh
5. Verify no dark overlay appears

## Related Files

- `packages/admin/src/App.tsx` - Main app component
- `packages/admin/src/components/Layout.tsx` - Layout wrapper
- `packages/admin/src/pages/DashboardPage.tsx` - Landing page
- `packages/admin/src/context/AuthContext.tsx` - Authentication context
- All Dialog/Modal components in admin package

## Next Steps

1. Apply immediate workaround to unblock
2. Investigate which dialog is causing the issue
3. Implement proper fix based on root cause
4. Add tests to prevent regression
