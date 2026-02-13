# Menu Verification Steps

## What Should Be Visible

After the changes, the left navigation menu should show:

1. **Back to Main Page** (replaces "Dashboard")
2. **Forms** (indented sub-menu item)
3. **Fields** (indented sub-menu item)
4. **Settings**
5. **Payments**
6. **Reporting**
7. **Users**
8. Plus any capability modules (Events, Memberships, etc.)

## How to Verify

1. Open your browser to: http://localhost:5176/orgadmin
2. Log in with your credentials
3. Look at the left sidebar menu
4. You should see "Forms" and "Fields" as indented menu items
5. Click "Forms" - should navigate to the forms list page
6. Click "Fields" - should navigate to the field definitions page

## If Menu Items Are Not Showing

The issue is likely that the browser is caching the old JavaScript bundle. Try:

1. **Hard Refresh**: Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
2. **Clear Cache**: Open DevTools (F12) → Application → Clear Storage → Clear site data
3. **Incognito Mode**: Open the app in an incognito/private window
4. **Check Console**: Open DevTools (F12) → Console tab and look for any errors

## Technical Details

### Changes Made:
- Added `subMenuItems` property to the forms module
- Updated Layout component to render sub-menu items
- Rebuilt orgadmin-core package
- Reinstalled dependencies in orgadmin-shell

### Files Modified:
- `packages/orgadmin-core/src/forms/index.ts`
- `packages/orgadmin-core/src/types/module.types.ts`
- `packages/orgadmin-shell/src/types/module.types.ts`
- `packages/orgadmin-shell/src/components/Layout.tsx`
- `packages/orgadmin-core/src/forms/pages/FieldsListPage.tsx` (new file)

### Build Commands Run:
```bash
# Rebuild orgadmin-core
cd packages/orgadmin-core
npm run build

# Reinstall dependencies in shell
cd ../orgadmin-shell
npm install

# Start the dev server
npm run dev
```

## Troubleshooting

If you still don't see the menu items after a hard refresh:

1. Stop the dev server (Ctrl+C)
2. Clear node_modules cache:
   ```bash
   rm -rf packages/orgadmin-shell/node_modules/@aws-web-framework
   ```
3. Reinstall:
   ```bash
   cd packages/orgadmin-shell
   npm install
   ```
4. Restart:
   ```bash
   npm run dev
   ```

---
**Application URL:** http://localhost:5176/orgadmin
**Status:** Running on port 5176
