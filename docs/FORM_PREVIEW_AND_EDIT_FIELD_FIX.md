# Form Preview and Edit Field Page Fixes

## Issues Fixed

### 1. Form Preview Not Showing Correct Components
**Problem**: The form preview page was not rendering the correct components based on field types. Select fields weren't showing dropdowns with options, radio buttons weren't appearing, multiselect wasn't working, etc.

**Root Cause**: The database stores field types using different naming conventions (e.g., `select`, `multiselect`, `textarea`, `radio`, `checkbox`) than what the FieldRenderer component expects (e.g., `single_select`, `multi_select`, `text_area`). Additionally, the options were stored as a simple string array but FieldRenderer expects objects with `{value, label}` format.

**Solution**: Added two transformation functions in `FormPreviewPage.tsx`:
1. `mapDatatypeToRenderer()` - Maps database field types to FieldRenderer expected types
2. `transformOptions()` - Converts string array options to `{value, label}` format and sets appropriate displayMode

**Files Modified**:
- `packages/orgadmin-core/src/forms/pages/FormPreviewPage.tsx`

### 2. Edit Field Page Infinite Reload Loop
**Problem**: When clicking "Edit Field" button, the page would reload constantly, eventually causing a rate limit error from the server.

**Root Cause**: The `useEffect` hook in EditFieldPage had the `t` (translation function) in its dependency array. The translation function reference was changing on every render, causing the useEffect to run repeatedly, which triggered API calls in a loop.

**Solution**: 
1. Removed `usePageHelp('edit')` call that was trying to register a non-existent help page
2. Removed `t` from the useEffect dependency array
3. Used hardcoded error messages in the useEffect instead of translated ones (translation still works in the UI)

**Files Modified**:
- `packages/orgadmin-core/src/forms/pages/EditFieldPage.tsx`

## Field Type Mappings

The following mappings are now applied in the form preview:

| Database Type | FieldRenderer Type | Component Rendered |
|--------------|-------------------|-------------------|
| text | text | Text input |
| textarea | text_area | Multi-line text area |
| number | number | Number input |
| email | email | Email input |
| phone | text | Text input |
| date | date | Date picker |
| time | time | Time picker |
| datetime | datetime | Date-time picker |
| boolean | boolean | Single checkbox |
| select | single_select | Dropdown (single selection) |
| multiselect | multi_select | Dropdown with checkboxes (multiple selection) |
| radio | single_select | Radio buttons |
| checkbox | multi_select | Dropdown with checkboxes |
| file | document_upload | File upload |
| image | document_upload | Image upload |

## Testing

To verify the fixes:

1. **Form Preview**:
   - Create fields of different types (select, radio, multiselect, checkbox, date, etc.)
   - Add the fields to a form
   - Preview the form
   - Verify each field renders with the correct component type
   - For select/radio/multiselect/checkbox fields, verify options appear correctly

2. **Edit Field**:
   - Go to Forms > Field Definitions
   - Click the edit icon on any field
   - Verify the page loads once and doesn't reload
   - Verify you can edit and save the field
   - Check browser console for any errors

## Troubleshooting

If you're still experiencing the infinite reload issue:

1. **Clear Browser Cache**: The browser might be caching the old version of the code
   - Chrome/Edge: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
   - Or do a hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

2. **Check Browser Console**: Open developer tools (F12) and check for:
   - Repeated API calls to `/api/orgadmin/application-fields/{id}`
   - Any JavaScript errors
   - Network tab showing rate limit errors (429 status)

3. **Restart Development Server**: If running in development mode:
   ```bash
   # Stop the server (Ctrl+C)
   # Clear node_modules cache if needed
   npm run dev
   ```

4. **Check for Translation Issues**: If the problem persists, check if the translation system is causing re-renders:
   - Look for console warnings about missing translation keys
   - Verify the `useTranslation` hook is working correctly

## Related Files

- `packages/orgadmin-core/src/forms/pages/FormPreviewPage.tsx` - Form preview with field rendering
- `packages/orgadmin-core/src/forms/pages/EditFieldPage.tsx` - Edit field definition page
- `packages/orgadmin-core/src/forms/pages/FieldsListPage.tsx` - Field list with edit button
- `packages/components/src/components/FieldRenderer/FieldRenderer.tsx` - Main field renderer component
- `packages/components/src/components/FieldRenderer/renderers/SelectRenderer.tsx` - Select/radio renderer
- `packages/components/src/components/FieldRenderer/renderers/MultiSelectRenderer.tsx` - Multi-select/checkbox renderer
- `packages/orgadmin-core/src/hooks/useApi.ts` - API hook with execute function

## Date

February 26, 2026
