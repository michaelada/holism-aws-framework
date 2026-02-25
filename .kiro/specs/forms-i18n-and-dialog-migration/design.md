# Design Document

## Overview

This design addresses the internationalization of the Forms module and the migration of field management from dialogs to dedicated pages. The implementation follows established patterns in the codebase:

1. **i18n Pattern**: Uses the `useTranslation` hook from `@aws-web-framework/orgadmin-shell/hooks/useTranslation` to access localized strings
2. **Dialog-to-Page Migration Pattern**: Follows the same approach documented in `USER_INVITATION_DIALOG_TO_PAGE_MIGRATION.md`
3. **Translation File Structure**: Extends the existing `forms` namespace in translation files across all 6 languages

The design maintains backward compatibility with existing forms and field definitions while improving the user experience through proper localization and full-page navigation.

## Architecture

### Component Structure

```
packages/orgadmin-core/src/forms/
├── pages/
│   ├── FormBuilderPage.tsx          (MODIFIED - add i18n)
│   ├── FormsListPage.tsx            (already has i18n)
│   ├── FieldsListPage.tsx           (MODIFIED - add i18n, remove dialogs)
│   ├── CreateFieldPage.tsx          (NEW)
│   └── EditFieldPage.tsx            (NEW)
└── index.ts                          (MODIFIED - add new routes)

packages/orgadmin-shell/src/locales/
├── en-GB/translation.json           (MODIFIED - add keys)
├── fr-FR/translation.json           (MODIFIED - add keys)
├── es-ES/translation.json           (MODIFIED - add keys)
├── it-IT/translation.json           (MODIFIED - add keys)
├── de-DE/translation.json           (MODIFIED - add keys)
└── pt-PT/translation.json           (MODIFIED - add keys)
```

### Navigation Flow

**Before (Dialogs):**
```
FieldsListPage
  ├─> [Create Dialog] -> Save -> Refresh List
  └─> [Edit Dialog] -> Save -> Refresh List
```

**After (Pages):**
```
FieldsListPage
  ├─> /forms/fields/new (CreateFieldPage) -> Save -> Navigate to /forms/fields
  └─> /forms/fields/:id/edit (EditFieldPage) -> Save -> Navigate to /forms/fields
```

## Components and Interfaces

### CreateFieldPage Component

**Purpose**: Dedicated page for creating new field definitions

**Props**: None (uses URL routing)

**State**:
- `fieldLabel: string` - Display label for the field
- `fieldDescription: string` - Optional description
- `fieldType: string` - Field data type (text, select, etc.)
- `fieldOptions: string[]` - Options for select/radio/checkbox types
- `newOption: string` - Temporary state for adding options
- `error: string | null` - Error message display
- `saving: boolean` - Save operation in progress

**Key Functions**:
- `handleCreate()` - Validates and submits field creation
- `handleAddOption()` - Adds option to fieldOptions array
- `handleRemoveOption(option)` - Removes option from array
- `generateFieldName(label)` - Converts label to snake_case name
- `requiresOptions(type)` - Checks if field type needs options

**Navigation**:
- Breadcrumbs: Home > Forms > Fields > Create Field
- Cancel button navigates to `/forms/fields`
- Success navigates to `/forms/fields` with success message

### EditFieldPage Component

**Purpose**: Dedicated page for editing existing field definitions

**Props**: None (uses URL parameter `:id`)

**State**:
- Same as CreateFieldPage, plus:
- `loading: boolean` - Field data loading state
- `fieldId: string` - ID from URL parameter

**Key Functions**:
- `loadField()` - Fetches field data by ID
- `handleUpdate()` - Validates and submits field update
- All other functions same as CreateFieldPage

**Navigation**:
- Breadcrumbs: Home > Forms > Fields > Edit Field
- Cancel button navigates to `/forms/fields`
- Success navigates to `/forms/fields` with success message
- Not found navigates to `/forms/fields` with error message

### Updated FieldsListPage Component

**Changes**:
1. Remove dialog state: `createDialogOpen`, `editDialogOpen`
2. Remove dialog handlers: `openCreateDialog()`, `openEditDialog()`
3. Remove dialog components: `<CreateFieldDialog>`, `<EditFieldDialog>`
4. Update "Create Field" button to navigate: `navigate('/forms/fields/new')`
5. Update edit icon click to navigate: `navigate(\`/forms/fields/\${field.id}/edit\`)`
6. Keep delete dialog functionality unchanged
7. Add i18n for all hardcoded strings

### Updated FormBuilderPage Component

**Changes**:
1. Import `useTranslation` hook
2. Replace all hardcoded English strings with `t('forms.builder.key')`
3. Update dialog titles, button labels, field labels, error messages
4. Update tab labels, section headers, empty state messages
5. Maintain all existing functionality and logic

## Data Models

### ApplicationField Interface

```typescript
interface ApplicationField {
  id: string;
  name: string;              // Auto-generated from label (snake_case)
  label: string;             // Display label
  description?: string;      // Optional description
  datatype: string;          // Field type
  options?: string[];        // For select/radio/checkbox types
  organisationId: string;
  createdAt: string;
  updatedAt: string;
}
```

### Field Type Constants

```typescript
const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'phone',
  'date',
  'time',
  'datetime',
  'boolean',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'file',
  'image',
];
```

### Field Types Requiring Options

```typescript
const TYPES_REQUIRING_OPTIONS = [
  'select',
  'multiselect',
  'radio',
  'checkbox'
];
```

## Translation Keys Structure

### New Translation Keys

All keys are added under the `forms` namespace in all 6 language files:

```json
{
  "forms": {
    "fields": {
      "title": "Field Definitions",
      "createField": "Create Field",
      "editField": "Edit Field",
      "createFieldPage": "Create Field Definition",
      "editFieldPage": "Edit Field Definition",
      "searchPlaceholder": "Search fields...",
      "noFieldsFound": "No fields yet. Create your first field to get started.",
      "noMatchingFields": "No fields match your filters",
      "loadingFields": "Loading fields...",
      "fieldLabel": "Field Label",
      "fieldLabelHelper": "Display label (e.g., First Name) - field name will be auto-generated",
      "fieldDescription": "Description",
      "fieldDescriptionHelper": "Optional detailed explanation of what this field is for",
      "fieldType": "Field Type",
      "fieldOptions": "Options",
      "addOption": "Add option",
      "optionsRequired": "At least one option is required for {{type}} fields",
      "fieldNameWillBe": "Field name will be: {{name}}",
      "invalidFieldName": "(invalid)",
      "allTypes": "All Types",
      "table": {
        "label": "Label",
        "description": "Description",
        "type": "Type",
        "created": "Created",
        "actions": "Actions"
      },
      "validation": {
        "labelRequired": "Field label is required",
        "labelAlphanumeric": "Field label must contain at least one alphanumeric character",
        "optionsRequired": "Field type \"{{type}}\" requires at least one option"
      },
      "delete": {
        "title": "Delete Field Definition",
        "message": "Are you sure you want to delete the field \"{{label}}\"? This action cannot be undone."
      }
    },
    "builder": {
      "title": "Form Builder",
      "createForm": "Create Form",
      "editForm": "Edit Form",
      "formDetails": "Form Details",
      "formName": "Form Name",
      "description": "Description",
      "cancel": "Cancel",
      "save": "Save",
      "saving": "Saving...",
      "tabs": {
        "fields": "Fields",
        "fieldGroups": "Field Groups",
        "wizardSteps": "Wizard Steps"
      },
      "fields": {
        "title": "Form Fields",
        "addField": "Add Field",
        "noFields": "No fields added yet. Click \"Add Field\" to get started.",
        "selectField": "Select Field",
        "mandatoryField": "Mandatory field",
        "makeRequired": "Make Required",
        "makeOptional": "Make Optional",
        "required": "Required",
        "optional": "Optional",
        "moveUp": "Move up",
        "moveDown": "Move down",
        "addFieldDialog": "Add Field"
      },
      "groups": {
        "title": "Field Groups",
        "addGroup": "Add Group",
        "noGroups": "No field groups defined. Groups help organize fields into sections.",
        "groupName": "Group Name",
        "groupDescription": "Description",
        "selectFields": "Select Fields for this Group",
        "noFieldsAvailable": "No fields available. Add fields to the form first.",
        "fieldOrder": "Field Order in Group",
        "addGroupDialog": "Add Field Group"
      },
      "wizard": {
        "title": "Wizard Steps",
        "addStep": "Add Step",
        "noSteps": "No wizard steps defined. Wizard steps create a multi-step form experience.",
        "stepName": "Step Name",
        
        "stepDescription": "Description",
        "selectFields": "Select Fields for this Step",
        "fieldOrder": "Field Order in Step",
        "stepNumber": "Step {{number}}: {{name}}",
        "addStepDialog": "Add Wizard Step"
      },
      "validation": {
        "formNameRequired": "Form name is required",
        "organisationMissing": "Organisation context is missing"
      },
      "messages": {
        "failedToLoad": "Failed to load form",
        "failedToSave": "Failed to save form"
      }
    }
  }
}
```

### Reused Common Keys

The design reuses existing common translation keys:
- `common.actions.save`
- `common.actions.cancel`
- `common.actions.delete`
- `common.actions.edit`
- `common.actions.add`
- `common.actions.create`
- `common.status.draft`
- `common.status.published`
- `common.messages.loading`
- `common.messages.saving`
- `common.validation.required`


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, most are implementation verification examples rather than universal properties. The criteria focus on:
- Specific UI elements using translation keys (examples to verify during code review)
- Route registration (configuration verification)
- Component structure (code inspection)
- Navigation behavior (integration testing)

These are best validated through:
1. **Code review**: Verify translation keys are used instead of hardcoded strings
2. **Integration tests**: Verify navigation flows work correctly
3. **Manual testing**: Verify UI displays correctly in all languages

Since this feature is primarily about refactoring existing functionality (adding i18n, moving dialogs to pages) rather than introducing new business logic, there are no universal properties that apply across all inputs. The correctness is verified by ensuring:
- All hardcoded strings are replaced with translation keys
- All translation keys exist in all 6 language files
- Navigation routes are correctly configured
- Existing functionality is preserved

### Example-Based Verification

The following examples should be verified during implementation:

**Example 1: FormBuilderPage uses translation keys**
- Verify that FormBuilderPage imports `useTranslation` hook
- Verify that all button labels use `t('forms.builder.key')` format
- Verify that all section titles use translation keys
- Verify that all error messages use translation keys
- **Validates: Requirements 1.1, 1.4, 1.5**

**Example 2: FieldsListPage uses translation keys**
- Verify that FieldsListPage imports `useTranslation` hook
- Verify that table headers use translation keys
- Verify that filter labels use translation keys
- Verify that empty state messages use translation keys
- **Validates: Requirements 2.1, 2.4, 2.5**

**Example 3: Translation files are complete**
- Verify that all new translation keys exist in en-GB/translation.json
- Verify that all new translation keys exist in fr-FR/translation.json
- Verify that all new translation keys exist in es-ES/translation.json
- Verify that all new translation keys exist in it-IT/translation.json
- Verify that all new translation keys exist in de-DE/translation.json
- Verify that all new translation keys exist in pt-PT/translation.json
- **Validates: Requirements 1.3, 2.3, 7.4**

**Example 4: CreateFieldPage route is registered**
- Verify that forms module index.ts includes route for `/forms/fields/new`
- Verify that route points to CreateFieldPage component
- Verify that CreateFieldPage is exported from module
- **Validates: Requirements 3.1, 5.1, 5.4**

**Example 5: EditFieldPage route is registered**
- Verify that forms module index.ts includes route for `/forms/fields/:id/edit`
- Verify that route points to EditFieldPage component
- Verify that EditFieldPage is exported from module
- **Validates: Requirements 4.1, 5.2, 5.4**

**Example 6: CreateFieldPage has correct structure**
- Verify that CreateFieldPage renders form with label, description, type, and options inputs
- Verify that CreateFieldPage includes breadcrumb navigation
- Verify that "Create Field" button calls handleCreate function
- Verify that Cancel button navigates to `/forms/fields`
- Verify that validation runs before submission
- **Validates: Requirements 3.2, 3.5, 3.6, 3.7**

**Example 7: EditFieldPage has correct structure**
- Verify that EditFieldPage loads field data on mount
- Verify that EditFieldPage populates form inputs with loaded data
- Verify that EditFieldPage includes breadcrumb navigation
- Verify that "Save" button calls handleUpdate function
- Verify that Cancel button navigates to `/forms/fields`
- Verify that validation runs before submission
- Verify that 404 errors navigate back to list with error message
- **Validates: Requirements 4.2, 4.5, 4.6, 4.7, 4.8**

**Example 8: FieldsListPage navigation updated**
- Verify that "Create Field" button navigates to `/forms/fields/new`
- Verify that Edit icon navigates to `/forms/fields/:id/edit`
- Verify that CreateFieldDialog component is removed
- Verify that EditFieldDialog component is removed
- Verify that dialog state variables are removed
- Verify that delete dialog functionality is preserved
- **Validates: Requirements 3.3, 4.3, 6.1, 6.2, 6.3, 6.4, 6.5**

**Example 9: Success navigation works**
- Verify that CreateFieldPage navigates to `/forms/fields` after successful creation
- Verify that EditFieldPage navigates to `/forms/fields` after successful update
- Verify that success messages are displayed after navigation
- **Validates: Requirements 3.4, 4.4**

**Example 10: Translation structure is consistent**
- Verify that new keys are under `forms.fields.*` and `forms.builder.*` namespaces
- Verify that common actions use `common.actions.*` keys
- Verify that key naming follows camelCase pattern
- Verify that hierarchical structure matches existing patterns
- **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

**Example 11: Existing functionality is preserved**
- Verify that form builder features (field groups, wizard steps) still work
- Verify that field type options (text, select, etc.) are unchanged
- Verify that field validation rules (options required for select types) are maintained
- Verify that API endpoints are not modified
- Verify that data structures are not modified
- **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

## Error Handling

### Translation Key Missing

**Scenario**: A translation key is used but not defined in a language file

**Handling**:
- The i18n framework will display the key itself (e.g., "forms.fields.title")
- This makes missing translations immediately visible during testing
- All keys must be added to all 6 language files before deployment

### Field Not Found (EditFieldPage)

**Scenario**: User navigates to `/forms/fields/invalid-id/edit`

**Handling**:
1. EditFieldPage attempts to load field data
2. API returns 404 error
3. Component catches error in try-catch block
4. Sets error state with localized message
5. Displays error alert with "Back to Fields" button
6. Button navigates to `/forms/fields`

### Validation Errors

**Scenario**: User submits form with invalid data

**Handling**:
1. Validation runs before API call
2. If validation fails, set error state with localized message
3. Display error alert above form
4. Focus on first invalid field
5. Do not submit to API

**Validation Rules**:
- Field label is required
- Field label must contain at least one alphanumeric character
- Field types requiring options (select, multiselect, radio, checkbox) must have at least one option

### API Errors

**Scenario**: API call fails during create or update

**Handling**:
1. Catch error in try-catch block
2. Set error state with localized message
3. Display error alert
4. Keep user on current page with form data intact
5. Allow user to retry or cancel

### Organization Context Missing

**Scenario**: Organization context is not available when creating a field

**Handling**:
1. Check for organization context before submission
2. If missing, display error message
3. Do not attempt API call
4. This should be rare as the app requires organization context to function

## Testing Strategy

### Unit Tests

Unit tests should focus on specific examples and edge cases:

1. **Translation Key Usage**
   - Test that components import and use `useTranslation` hook
   - Test that translation keys are passed to `t()` function
   - Test that no hardcoded English strings remain in JSX

2. **Navigation Behavior**
   - Test that buttons call `navigate()` with correct paths
   - Test that success handlers navigate after API response
   - Test that cancel buttons navigate to list page

3. **Validation Logic**
   - Test that empty label is rejected
   - Test that label with only special characters is rejected
   - Test that select type without options is rejected
   - Test that valid data passes validation

4. **Field Name Generation**
   - Test that "First Name" becomes "first_name"
   - Test that "Email Address" becomes "email_address"
   - Test that special characters are removed
   - Test that multiple spaces become single underscore

5. **Options Management**
   - Test that adding option appends to array
   - Test that removing option filters array
   - Test that duplicate options are prevented
   - Test that empty options are rejected

6. **Error Handling**
   - Test that API errors set error state
   - Test that 404 errors trigger navigation
   - Test that validation errors display messages
   - Test that missing organization context is handled

### Integration Tests

Integration tests should verify end-to-end flows:

1. **Create Field Flow**
   - Navigate to `/forms/fields/new`
   - Fill in form fields
   - Submit form
   - Verify API call is made
   - Verify navigation to `/forms/fields`
   - Verify success message is displayed

2. **Edit Field Flow**
   - Navigate to `/forms/fields/:id/edit`
   - Verify field data is loaded
   - Modify form fields
   - Submit form
   - Verify API call is made
   - Verify navigation to `/forms/fields`
   - Verify success message is displayed

3. **Cancel Navigation**
   - Navigate to create or edit page
   - Click cancel button
   - Verify navigation to `/forms/fields`
   - Verify no API call is made

4. **Validation Flow**
   - Navigate to create page
   - Submit empty form
   - Verify error message is displayed
   - Verify no API call is made
   - Fill in required fields
   - Submit form
   - Verify API call is made

5. **Translation Switching**
   - Load page in English
   - Verify English text is displayed
   - Switch to French
   - Verify French text is displayed
   - Repeat for all 6 languages

### Manual Testing Checklist

1. **Visual Verification**
   - [ ] All pages display correctly in all 6 languages
   - [ ] No hardcoded English text is visible
   - [ ] Breadcrumbs display correctly
   - [ ] Form layouts are consistent
   - [ ] Error messages are localized

2. **Navigation Testing**
   - [ ] Create Field button navigates to create page
   - [ ] Edit icon navigates to edit page
   - [ ] Cancel buttons navigate back to list
   - [ ] Success navigation works after create/update
   - [ ] Direct URL navigation works for all routes

3. **Functionality Testing**
   - [ ] Can create field with all field types
   - [ ] Can edit existing fields
   - [ ] Can add/remove options for select types
   - [ ] Validation prevents invalid submissions
   - [ ] Delete dialog still works on list page
   - [ ] Form builder still works with all features

4. **Error Testing**
   - [ ] Invalid field ID shows error and navigation
   - [ ] API errors display error messages
   - [ ] Validation errors display correctly
   - [ ] Missing organization context is handled

5. **Backward Compatibility**
   - [ ] Existing forms still load correctly
   - [ ] Existing fields still display correctly
   - [ ] No data migration is required
   - [ ] All existing features still work

### Test Configuration

- **Unit tests**: Use Jest with React Testing Library
- **Integration tests**: Use Playwright or Cypress for E2E testing
- **Translation tests**: Verify all keys exist in all language files using a script
- **Manual tests**: Test in all 6 languages before deployment

### Test Coverage Goals

- Unit test coverage: 80% for new components
- Integration test coverage: All critical user flows
- Translation coverage: 100% of all keys in all 6 languages
- Manual test coverage: All features in at least 2 languages (English + one other)
