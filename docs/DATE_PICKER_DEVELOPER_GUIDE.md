# Date Picker Developer Guide

## Overview

This guide explains how to correctly use date, time, and datetime pickers in the application. Following these guidelines will prevent LocalizationProvider context errors and ensure date pickers work correctly in both development and production environments.

## Quick Start

### Using Date Pickers in a New Page

To use date pickers in your page, you must wrap your content in a `LocalizationProvider`:

```typescript
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { FieldRenderer } from '@aws-web-framework/components';

export function MyFormPage() {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        {/* Your form content with FieldRenderer */}
        <FieldRenderer 
          fieldDefinition={{ datatype: 'date', ... }} 
          value={dateValue}
          onChange={handleChange}
        />
      </Box>
    </LocalizationProvider>
  );
}
```

### Key Points

1. **Always wrap date pickers in LocalizationProvider** - The provider must be an ancestor of any date/time/datetime field
2. **Use AdapterDateFns** - This is the date library adapter we use throughout the application
3. **Use enGB locale** - This is our default locale for date formatting
4. **Import from correct paths** - Use the full subpath imports shown above

## LocalizationProvider Requirements

### What is LocalizationProvider?

`LocalizationProvider` is a React context provider from MUI X that supplies date/time utilities to date picker components. Without it, date pickers cannot function and will throw context errors.

### Where to Place LocalizationProvider

**✅ Correct: Page Level**

Place the provider at the page component level, wrapping all content that may contain date pickers:

```typescript
// FormPreviewPage.tsx
export function FormPreviewPage() {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box>
        {/* All form content */}
      </Box>
    </LocalizationProvider>
  );
}
```

**❌ Incorrect: Component Level (DateRenderer)**

Do NOT add LocalizationProvider inside shared components like `DateRenderer`. This causes module resolution issues in development mode:

```typescript
// DateRenderer.tsx - DON'T DO THIS
export function DateRenderer({ ... }) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <DatePicker {...props} />
    </LocalizationProvider>
  );
}
```

**❌ Incorrect: App Level**

Do NOT add LocalizationProvider at the root App level. This loads date-fns for all pages, even those without date pickers, increasing bundle size unnecessarily.

### Required Imports

Always use these exact imports:

```typescript
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
```

### Configuration

Use this exact configuration:

```typescript
<LocalizationProvider 
  dateAdapter={AdapterDateFns} 
  adapterLocale={enGB}
>
  {/* Your content */}
</LocalizationProvider>
```

- `dateAdapter={AdapterDateFns}` - Uses date-fns as the date manipulation library
- `adapterLocale={enGB}` - Sets UK English as the default locale

## Using FieldRenderer with Date Fields

The `FieldRenderer` component automatically renders the appropriate date picker based on the field definition's `datatype`:

```typescript
import { FieldRenderer } from '@aws-web-framework/components';

// Date field
<FieldRenderer 
  fieldDefinition={{ 
    id: 'birthdate',
    datatype: 'date',
    label: 'Birth Date',
    // ... other properties
  }} 
  value={dateValue}
  onChange={handleChange}
/>

// Time field
<FieldRenderer 
  fieldDefinition={{ 
    id: 'appointment',
    datatype: 'time',
    label: 'Appointment Time',
  }} 
  value={timeValue}
  onChange={handleChange}
/>

// DateTime field
<FieldRenderer 
  fieldDefinition={{ 
    id: 'event',
    datatype: 'datetime',
    label: 'Event Date & Time',
  }} 
  value={datetimeValue}
  onChange={handleChange}
/>
```

### Multiple Date Fields

When rendering multiple date fields in the same form, use a single `LocalizationProvider` wrapping all fields:

```typescript
<LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
  <Box>
    <FieldRenderer fieldDefinition={startDateField} ... />
    <FieldRenderer fieldDefinition={endDateField} ... />
    <FieldRenderer fieldDefinition={appointmentTimeField} ... />
  </Box>
</LocalizationProvider>
```

## Troubleshooting

### Error: "Can not find utils in context"

**Full Error Message:**
```
MUI: Can not find utils in context. It looks like you forgot to wrap your component in LocalizationProvider, or pass dateAdapter prop directly.
```

**Cause:** Date picker component is rendered without a `LocalizationProvider` ancestor.

**Solution:**
1. Check that your page component wraps content in `LocalizationProvider`
2. Verify the imports are correct (see Required Imports section)
3. Ensure `LocalizationProvider` is an ancestor of the date picker, not a sibling

**Example Fix:**

```typescript
// ❌ Before (Missing Provider)
export function MyPage() {
  return (
    <Box>
      <FieldRenderer fieldDefinition={{ datatype: 'date', ... }} />
    </Box>
  );
}

// ✅ After (Provider Added)
export function MyPage() {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box>
        <FieldRenderer fieldDefinition={{ datatype: 'date', ... }} />
      </Box>
    </LocalizationProvider>
  );
}
```

### Error: Blank Screen in Development Mode

**Symptoms:**
- Form preview shows blank screen
- Console shows repeated LocalizationProvider errors
- Works in production build but not in dev mode

**Cause:** Vite's module resolution is loading multiple instances of `@mui/x-date-pickers`, breaking React context.

**Solution:**
This should already be fixed in the Vite configuration. If you encounter this:

1. **Clear Vite cache:**
   ```bash
   rm -rf packages/orgadmin-shell/node_modules/.vite
   ```

2. **Restart dev server:**
   ```bash
   npm run dev
   ```

3. **Hard refresh browser:**
   - Chrome/Edge: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
   - Firefox: Cmd+Shift+R (Mac) or Ctrl+F5 (Windows/Linux)

4. **Verify Vite configuration** includes date pickers in `optimizeDeps.include`:
   ```typescript
   // packages/orgadmin-shell/vite.config.ts
   optimizeDeps: {
     include: [
       '@mui/x-date-pickers',
       '@mui/x-date-pickers/AdapterDateFns',
       '@mui/x-date-pickers/LocalizationProvider',
       '@mui/x-date-pickers/DatePicker',
       '@mui/x-date-pickers/TimePicker',
       '@mui/x-date-pickers/DateTimePicker',
       'date-fns',
     ],
   }
   ```

### Error: Date Picker Not Rendering

**Symptoms:**
- Date picker field doesn't appear
- No console errors
- Other fields render correctly

**Possible Causes & Solutions:**

1. **Incorrect datatype value:**
   - Check that `fieldDefinition.datatype` is exactly `'date'`, `'time'`, or `'datetime'`
   - Case-sensitive: must be lowercase

2. **Missing field definition properties:**
   - Ensure `fieldDefinition` has required properties: `id`, `datatype`, `label`

3. **Component not re-rendering:**
   - Check that state updates are triggering re-renders
   - Verify React DevTools shows updated props

### Error: Date Format Issues

**Symptoms:**
- Dates display in wrong format
- Validation errors on valid dates
- Timezone issues

**Solutions:**

1. **Verify locale is set correctly:**
   ```typescript
   import { enGB } from 'date-fns/locale';
   <LocalizationProvider adapterLocale={enGB}>
   ```

2. **Check date value format:**
   - Date values should be JavaScript `Date` objects or ISO 8601 strings
   - Example: `new Date()` or `"2024-03-15T10:30:00Z"`

3. **Timezone handling:**
   - Date pickers use local timezone by default
   - For UTC dates, convert before passing to picker

### Error: Module Resolution Warnings

**Symptoms:**
- Build warnings about duplicate modules
- Multiple versions of `@mui/x-date-pickers` detected

**Solution:**

1. **Check package versions are consistent:**
   ```bash
   # Search for all instances
   grep -r "@mui/x-date-pickers" packages/*/package.json
   ```

2. **All packages should use the same version:**
   ```json
   "@mui/x-date-pickers": "^6.19.4"
   ```

3. **Run clean install:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## Best Practices

### 1. Single LocalizationProvider Per Page

Use one provider at the page level, not multiple providers:

```typescript
// ✅ Good: Single provider
<LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
  <Section1 />
  <Section2 />
  <Section3 />
</LocalizationProvider>

// ❌ Bad: Multiple providers
<>
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    <Section1 />
  </LocalizationProvider>
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    <Section2 />
  </LocalizationProvider>
</>
```

### 2. Consistent Imports

Always import from the same paths to ensure module consistency:

```typescript
// ✅ Good: Specific subpath imports
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// ❌ Bad: Barrel imports (may cause issues)
import { LocalizationProvider, AdapterDateFns } from '@mui/x-date-pickers';
```

### 3. Code Comments

Add comments explaining the LocalizationProvider requirement:

```typescript
// LocalizationProvider is required for date/time/datetime pickers
// It provides date formatting and localization context to MUI X date components
// See: docs/DATE_PICKER_DEVELOPER_GUIDE.md
<LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
  {/* Form content */}
</LocalizationProvider>
```

### 4. Testing Date Pickers

When writing tests for components with date pickers, wrap them in LocalizationProvider:

```typescript
import { render } from '@testing-library/react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';

function renderWithProvider(component: React.ReactElement) {
  return render(
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      {component}
    </LocalizationProvider>
  );
}

test('renders date picker', () => {
  renderWithProvider(<MyComponent />);
  // ... assertions
});
```

### 5. Lazy Loading Considerations

Date pickers are code-split into a separate chunk. Pages without date pickers won't load the date picker bundle, keeping initial load times fast.

## Technical Background

### Why This Architecture?

**Problem:** In a monorepo with Vite, multiple packages importing `@mui/x-date-pickers` can result in multiple module instances being loaded. React context doesn't work across different module instances.

**Solution:** 
1. Vite's `optimizeDeps.include` pre-bundles date picker packages into a single instance
2. LocalizationProvider at page level provides context to all date pickers
3. DateRenderer component doesn't include its own provider, relying on parent

### Module Resolution

The Vite configuration ensures single module instance:

```typescript
// packages/orgadmin-shell/vite.config.ts
export default defineConfig({
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/x-date-pickers',
      'date-fns',
    ],
  },
  optimizeDeps: {
    include: [
      '@mui/x-date-pickers',
      '@mui/x-date-pickers/AdapterDateFns',
      '@mui/x-date-pickers/LocalizationProvider',
      '@mui/x-date-pickers/DatePicker',
      '@mui/x-date-pickers/TimePicker',
      '@mui/x-date-pickers/DateTimePicker',
      'date-fns',
    ],
  },
});
```

- `dedupe`: Forces Vite to use single instance of these packages
- `optimizeDeps.include`: Pre-bundles date pickers to ensure consistency

### Development vs Production

- **Development Mode:** Vite serves source files with hot module replacement. The `optimizeDeps` configuration is critical for preventing module duplication.
- **Production Mode:** Everything is bundled together, so module instance issues don't occur.

## Examples

### Example 1: Simple Form with Date Field

```typescript
import { useState } from 'react';
import { Box, Button } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { FieldRenderer } from '@aws-web-framework/components';

export function EventRegistrationPage() {
  const [eventDate, setEventDate] = useState<Date | null>(null);

  const dateFieldDefinition = {
    id: 'event-date',
    datatype: 'date' as const,
    label: 'Event Date',
    mandatory: true,
  };

  const handleSubmit = () => {
    console.log('Event date:', eventDate);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        <FieldRenderer
          fieldDefinition={dateFieldDefinition}
          value={eventDate}
          onChange={setEventDate}
        />
        <Button onClick={handleSubmit} variant="contained" sx={{ mt: 2 }}>
          Submit
        </Button>
      </Box>
    </LocalizationProvider>
  );
}
```

### Example 2: Form with Multiple Date/Time Fields

```typescript
import { useState } from 'react';
import { Box, Stack } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { FieldRenderer } from '@aws-web-framework/components';

export function AppointmentBookingPage() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [appointmentTime, setAppointmentTime] = useState<Date | null>(null);

  const fieldDefinitions = {
    startDate: {
      id: 'start-date',
      datatype: 'date' as const,
      label: 'Start Date',
      mandatory: true,
    },
    endDate: {
      id: 'end-date',
      datatype: 'date' as const,
      label: 'End Date',
      mandatory: true,
    },
    appointmentTime: {
      id: 'appointment-time',
      datatype: 'time' as const,
      label: 'Preferred Time',
      mandatory: false,
    },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <FieldRenderer
            fieldDefinition={fieldDefinitions.startDate}
            value={startDate}
            onChange={setStartDate}
          />
          <FieldRenderer
            fieldDefinition={fieldDefinitions.endDate}
            value={endDate}
            onChange={setEndDate}
          />
          <FieldRenderer
            fieldDefinition={fieldDefinitions.appointmentTime}
            value={appointmentTime}
            onChange={setAppointmentTime}
          />
        </Stack>
      </Box>
    </LocalizationProvider>
  );
}
```

### Example 3: Dynamic Form with Conditional Date Fields

```typescript
import { useState } from 'react';
import { Box, FormControlLabel, Switch } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { FieldRenderer } from '@aws-web-framework/components';

export function ConditionalFormPage() {
  const [showDateField, setShowDateField] = useState(false);
  const [dateValue, setDateValue] = useState<Date | null>(null);

  const dateFieldDefinition = {
    id: 'optional-date',
    datatype: 'date' as const,
    label: 'Optional Date',
    mandatory: false,
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showDateField}
              onChange={(e) => setShowDateField(e.target.checked)}
            />
          }
          label="Include date field"
        />
        
        {showDateField && (
          <FieldRenderer
            fieldDefinition={dateFieldDefinition}
            value={dateValue}
            onChange={setDateValue}
          />
        )}
      </Box>
    </LocalizationProvider>
  );
}
```

## Related Documentation

- [Date Picker Localization Final Fix](./DATE_PICKER_LOCALIZATION_FINAL_FIX.md) - Technical details of the fix
- [System Architecture](./SYSTEM_ARCHITECTURE.md) - Overall system architecture
- [MUI X Date Pickers Documentation](https://mui.com/x/react-date-pickers/) - Official MUI X docs

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [Related Documentation](#related-documentation)
3. Check browser console for specific error messages
4. Verify Vite configuration matches the examples in this guide
5. Clear Vite cache and restart dev server

## Summary

**Key Takeaways:**

1. ✅ Always wrap date pickers in `LocalizationProvider` at the page level
2. ✅ Use `AdapterDateFns` with `enGB` locale
3. ✅ Import from specific subpaths: `@mui/x-date-pickers/LocalizationProvider`
4. ✅ One provider per page, wrapping all date fields
5. ❌ Don't add provider inside shared components
6. ❌ Don't add provider at app root level
7. ❌ Don't use barrel imports from `@mui/x-date-pickers`

Following these guidelines ensures date pickers work correctly in both development and production environments.
