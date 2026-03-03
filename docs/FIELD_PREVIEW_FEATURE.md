# Live Field Preview Feature

## Overview

Added a live preview feature to the Create Field Definition page that shows how the field will appear to users as they configure it.

## Changes Made

### 1. CreateFieldPage Enhancement
**File**: `packages/orgadmin-core/src/forms/pages/CreateFieldPage.tsx`

**New Features**:
- Split-screen layout with form configuration on the left and live preview on the right
- Real-time preview updates as user types or changes field settings
- Preview shows the actual FieldRenderer component that will be used in forms
- Sticky preview panel that stays visible while scrolling
- Interactive preview - users can test the field behavior

**Implementation Details**:
- Added `previewValue` state to track preview field value
- Added `mapDatatypeToRenderer()` function to convert database field types to FieldRenderer types
- Added `transformOptionsForPreview()` function to format options for the preview
- Used Material-UI Grid layout for responsive two-column design
- Preview panel is sticky (position: sticky) for better UX

### 2. Keyboard Shortcut Fix
**File**: `packages/orgadmin-shell/src/context/OnboardingProvider.tsx`

**Issue**: The help drawer keyboard shortcut (Shift+?) was triggering when users typed question marks in input fields.

**Solution**: Added check to ignore the keyboard shortcut when user is focused on:
- INPUT elements
- TEXTAREA elements
- Contenteditable elements
- Elements inside contenteditable containers

This allows normal typing of question marks in form fields without accidentally opening the help drawer.

## User Experience

### Before
- Users had to create a field, save it, add it to a form, and preview the form to see how it looked
- No way to test field behavior during creation
- Question marks in input fields would open the help drawer

### After
- Users see a live preview as they type the field label and description
- Field type changes are immediately reflected in the preview
- Options added to select/radio/multiselect fields appear in the preview instantly
- Users can interact with the preview to test field behavior
- Question marks can be typed normally in input fields

## Preview Features

### Field Types Supported
All field types show appropriate previews:
- **Text**: Single-line text input
- **Textarea**: Multi-line text area
- **Number**: Number input with spinners
- **Email**: Email input with validation
- **Phone**: Text input (formatted as phone)
- **Date**: Date picker
- **Time**: Time picker
- **Datetime**: Date-time picker
- **Boolean**: Single checkbox
- **Select**: Dropdown menu with options
- **Multiselect**: Multi-select dropdown with checkboxes
- **Radio**: Radio button group
- **Checkbox**: Multi-select with checkboxes (dropdown format)
- **File**: File upload button
- **Image**: Image upload button

### Preview Behavior
- Shows placeholder text when no field label is entered
- Updates in real-time as user types
- Displays field description as helper text
- Shows options for select/radio/multiselect/checkbox fields
- Allows interaction to test field behavior
- Resets preview value when field type changes

## Layout

### Desktop (md and up)
- Two-column layout (50/50 split)
- Form configuration on the left
- Live preview on the right (sticky)

### Mobile (sm and down)
- Stacked layout
- Form configuration first
- Preview below

## Translation Keys Added

The following translation keys should be added to support the new feature:

```json
{
  "forms": {
    "fields": {
      "fieldConfiguration": "Field Configuration",
      "livePreview": "Live Preview",
      "previewDescription": "This is how the field will appear to users",
      "previewPlaceholder": "Start typing a field label to see a preview"
    }
  }
}
```

If these keys are missing, the UI will display the key names as fallback text.

## Technical Details

### Field Type Mapping
The preview uses the same mapping as FormPreviewPage:

| Database Type | FieldRenderer Type |
|--------------|-------------------|
| text | text |
| textarea | text_area |
| number | number |
| email | email |
| phone | text |
| date | date |
| time | time |
| datetime | datetime |
| boolean | boolean |
| select | single_select |
| multiselect | multi_select |
| radio | single_select (radio mode) |
| checkbox | multi_select |
| file | document_upload |
| image | document_upload |

### Options Transformation
Options are transformed from string array to object array:
```typescript
// Input: ['Option 1', 'Option 2']
// Output: [
//   { value: 'Option 1', label: 'Option 1' },
//   { value: 'Option 2', label: 'Option 2' }
// ]
```

Display mode is set based on field type:
- `radio` type → `displayMode: 'radio'`
- Other types → `displayMode: 'dropdown'`

## Benefits

1. **Faster Iteration**: Users can see and test fields before saving
2. **Better UX**: Immediate feedback on field configuration
3. **Reduced Errors**: Users can catch issues before creating the field
4. **Learning Tool**: Helps users understand how different field types work
5. **Time Savings**: No need to create, save, and preview separately

## Future Enhancements

Potential improvements for future versions:
- Add validation preview (show how validation errors appear)
- Add required field indicator in preview
- Show character count for text fields with max length
- Preview conditional logic (if implemented)
- Mobile-optimized preview layout
- Preview theme customization

## Testing

To test the feature:

1. Navigate to Forms > Field Definitions
2. Click "Create Field"
3. Start typing a field label - preview appears on the right
4. Change field type - preview updates immediately
5. For select/radio/multiselect/checkbox:
   - Add options
   - See them appear in the preview
   - Interact with the preview to test selection
6. Try typing a question mark in any input field - help drawer should NOT open
7. Try Shift+? when NOT in an input field - help drawer SHOULD open

## Date

February 26, 2026
