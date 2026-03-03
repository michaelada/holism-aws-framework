# Form Preview Blank Screen Fix - LocalizationProvider Error

## Problem
When clicking the Preview button on a form that contains date, time, or datetime fields, the preview page shows a blank screen with the following error in the browser console:

```
Uncaught Error: MUI: Can not find utils in context. It looks like you forgot to wrap your component in LocalizationProvider, or pass dateAdapter prop directly.
```

## Root Cause
The issue was caused by Vite's module resolution in development mode. When the `DateRenderer` component (in the components package) had its own `LocalizationProvider`, Vite was loading `@mui/x-date-pickers` from different module instances, causing the React context to not propagate correctly between the provider and the date picker components.

This is a known issue with Vite in monorepo setups where shared libraries use React context.

## Solution
Removed the `LocalizationProvider` from the `DateRenderer` component and added it at the page level in the consuming components. This ensures the LocalizationProvider and date pickers are loaded from the same module instance.

### Changes Made

#### 1. DateRenderer.tsx (components package)
Removed LocalizationProvider wrapper - date pickers now rely on parent component to provide the context:

```typescript
// REMOVED these imports:
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
// import { enGB } from 'date-fns/locale';

export function DateRenderer({ ... }: DateRendererProps): JSX.Element {
  // ... component logic ...
  
  // Date pickers rely on LocalizationProvider from parent component
  return (
    <>
      {fieldDefinition.datatype === 'date' && <DatePicker {...commonProps} />}
      {fieldDefinition.datatype === 'time' && <TimePicker {...commonProps} />}
      {fieldDefinition.datatype === 'datetime' && <DateTimePicker {...commonProps} />}
    </>
  );
}
```

#### 2. FormPreviewPage.tsx (orgadmin-core)
Added LocalizationProvider wrapper around entire page content:

```typescript
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';

return (
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    <Box sx={{ p: 3 }}>
      {/* All form preview content */}
    </Box>
  </LocalizationProvider>
);
```

#### 3. CreateFieldPage.tsx (orgadmin-core)
Added LocalizationProvider wrapper around live preview FieldRenderer:

```typescript
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';

<LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
  <FieldRenderer
    fieldDefinition={{...}}
    value={previewValue}
    onChange={setPreviewValue}
    disabled={false}
    required={false}
  />
</LocalizationProvider>
```

#### 4. Rebuilt components package
```bash
cd packages/components
npm run build
```

## Why This Fix Works

### Module Resolution Issue
In Vite's dev mode with a monorepo:
- The components package imports `@mui/x-date-pickers`
- The orgadmin-core package also imports `@mui/x-date-pickers`
- Vite may load these from different module instances
- React context doesn't work across different module instances
- Result: LocalizationProvider context not found by date pickers

### Solution Approach
- Remove LocalizationProvider from the shared component (DateRenderer)
- Add LocalizationProvider in the consuming page (FormPreviewPage, CreateFieldPage)
- Both provider and date pickers now load from the same module instance
- React context works correctly

## Testing
After making these changes and rebuilding:

1. Restart the orgadmin dev server
2. Clear browser cache (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
3. Navigate to Forms module
4. Select any form that has date/time/datetime fields
5. Click the Preview button
6. Verify that:
   - The form preview page loads without errors
   - Date/time/datetime fields render correctly
   - No LocalizationProvider errors appear in console
   - Fields are interactive and functional
7. Test the live preview in Create Field Definition page:
   - Create a date/time/datetime field
   - Verify the live preview shows the field correctly
   - No console errors

## Important Notes

### DateRenderer Usage
Any component using `DateRenderer` must now wrap it in `LocalizationProvider`:

```typescript
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { FieldRenderer } from '@aws-web-framework/components';

<LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
  <FieldRenderer fieldDefinition={...} ... />
</LocalizationProvider>
```

### Why Not Add to App Level?
- Date pickers only used in specific pages (forms module)
- Adding at app level would load date-fns for all pages
- Current solution is more targeted and efficient

## Related Files
- `packages/components/src/components/FieldRenderer/renderers/DateRenderer.tsx` - Removed LocalizationProvider
- `packages/orgadmin-core/src/forms/pages/FormPreviewPage.tsx` - Added LocalizationProvider wrapper
- `packages/orgadmin-core/src/forms/pages/CreateFieldPage.tsx` - Added LocalizationProvider wrapper for live preview

## Package Versions
- `@mui/x-date-pickers`: ^5.0.20
- `date-fns`: ^2.30.0
- `@mui/material`: ^5.15.9

## Date
February 26, 2026
