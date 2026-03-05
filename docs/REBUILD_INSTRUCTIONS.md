# Rebuild Instructions for Auth Error Fix

## Issue
After making changes to `packages/orgadmin-shell/src/hooks/useAuth.ts`, you're still seeing the old behavior (infinite loading screen) because the frontend hasn't been rebuilt with the new code.

## Solution

You need to rebuild the orgadmin-shell package. Here are the steps:

### Option 1: Rebuild Just the Shell Package (Faster)

```bash
cd packages/orgadmin-shell
npm run build
```

Then restart your development server if it's running.

### Option 2: Rebuild Everything (More Thorough)

```bash
# From the root of the project
npm run build

# Or if you have a specific build command for orgadmin
npm run build:orgadmin
```

### Option 3: Development Mode with Hot Reload

If you're running in development mode, you might just need to:

1. Stop the development server (Ctrl+C)
2. Clear the build cache:
   ```bash
   rm -rf packages/orgadmin-shell/dist
   rm -rf packages/orgadmin-shell/.vite
   ```
3. Restart the development server:
   ```bash
   npm run dev
   # or
   npm run dev:orgadmin
   ```

### Verify the Fix

After rebuilding:

1. Clear your browser cache or open an incognito window
2. Try to login with a super admin account
3. You should now see an error screen with the message:
   - "User is not an organization administrator or account is not active"
   - A "Return to Login" button

Instead of the infinite "Loading ItsPlainSailing..." screen.

## What Changed

The `useAuth` hook now:
- Properly extracts error messages from the backend response
- Sets `loading` to `false` when an error occurs
- Displays the error screen with a logout button

## Troubleshooting

If you still see the loading screen after rebuilding:

1. **Hard refresh your browser**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. **Clear browser cache completely**
3. **Check browser console** for any errors
4. **Verify the build completed successfully** - check for any build errors in the terminal
