# Form Preview Date Picker LocalizationProvider Error Fix

## Problem
When previewing a form with date, time, or datetime fields, the browser console shows the error:
```
Uncaught Error: MUI: Can not find utils in context. It looks like you forgot to wrap your component in LocalizationProvider, or pass dateAdapter prop directly.
```

This causes the form preview page to show a blank screen.

## Root Cause
The `DateRenderer` component in the `@aws-web-framework/components` package already wraps date pickers in `LocalizationProvider`. However, there may be an issue with how the LocalizationProvider is being instantiated or a version mismatch.

## Current Implementation
The `DateRenderer` component (packages/components/src/components/FieldRenderer/renderers/DateRenderer.tsx) already includes:

```typescript
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';

// ...

return (
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    {fieldDefinition.datatype === 'date' && <DatePicker {...commonProps} />}
    {fieldDefinition.datatype === 'time' && <TimePicker {...commonProps} />}
    {fieldDefinition.datatype === 'datetime' && <DateTimePicker {...commonProps} />}
  </LocalizationProvider>
);
```

## Investigation Steps

### 1. Check Package Versions
The components package uses `@mui/x-date-pickers` version 5.0.20:
```json
"@mui/x-date-pickers": "^5.0.20"
```

### 2. Verify Date-fns Installation
Ensure `date-fns` is installed in the components package:
```json
"date-fns": "^2.30.0"
```

### 3. Check for Multiple Instances
Multiple versions of `@mui/x-date-pickers` or `date-fns` in the monorepo could cause conflicts.

## Potential Solutions

### Solution 1: Rebuild Components Package
The issue might be resolved by rebuilding the components package:

```bash
cd packages/components
npm run build
```

Then restart the dev server for orgadmin-core.

### Solution 2: Check Import Resolution
Verify that the FormPreviewPage is correctly importing from the components package:

```typescript
import { FieldRenderer } from '@aws-web-framework/components';
```

### Solution 3: Add LocalizationProvider at App Level (Alternative)
If the issue persists, consider adding a global LocalizationProvider in the orgadmin-shell App.tsx:

```typescript
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';

function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      {/* Rest of app */}
    </LocalizationProvider>
  );
}
```

### Solution 4: Verify Vite Build Configuration
Check if Vite is properly handling the date-fns and MUI X packages. The vite.config.ts might need optimization configuration:

```typescript
export default defineConfig({
  optimizeDeps: {
    include: [
      '@mui/x-date-pickers',
      '@mui/x-date-pickers/AdapterDateFns',
      'date-fns'
    ]
  }
});
```

## Testing
After applying any solution:

1. Clear browser cache and reload
2. Navigate to Forms → Select a form → Click Preview
3. Verify that date/time/datetime fields render correctly
4. Check browser console for errors

## Related Files
- `packages/components/src/components/FieldRenderer/renderers/DateRenderer.tsx`
- `packages/orgadmin-core/src/forms/pages/FormPreviewPage.tsx`
- `packages/components/package.json`
- `packages/orgadmin-core/package.json`

## Date
February 26, 2026
