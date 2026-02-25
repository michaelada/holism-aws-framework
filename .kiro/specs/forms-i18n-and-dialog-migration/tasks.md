# Implementation Plan: Forms i18n and Dialog Migration

## Overview

This implementation plan converts the Forms module to use internationalization and migrates field management from dialogs to dedicated pages. The work is organized into logical phases: translation setup, page creation, page integration, and cleanup.

## Tasks

- [x] 1. Add translation keys to all language files
  - Add comprehensive translation keys under the `forms.fields` and `forms.builder` namespaces
  - Add keys to all 6 language files: en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT
  - Follow the translation key structure defined in the design document
  - Reuse common keys from `common.actions` and `common.validation` where applicable
  - _Requirements: 1.3, 2.3, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 2. Create CreateFieldPage component
  - [x] 2.1 Create CreateFieldPage.tsx with form structure
    - Create new file at `packages/orgadmin-core/src/forms/pages/CreateFieldPage.tsx`
    - Import necessary dependencies (React, MUI components, hooks)
    - Set up component state (fieldLabel, fieldDescription, fieldType, fieldOptions, error, saving)
    - Implement form layout with all required inputs (label, description, type, options)
    - Add breadcrumb navigation component
    - _Requirements: 3.2, 3.6_
  
  - [x] 2.2 Implement field creation logic
    - Implement `generateFieldName()` function to convert label to snake_case
    - Implement `requiresOptions()` function to check if field type needs options
    - Implement `handleAddOption()` and `handleRemoveOption()` for options management
    - Implement validation logic (label required, options required for certain types)
    - Implement `handleCreate()` function to submit field creation via API
    - Add error handling for API failures
    - _Requirements: 3.7, 8.2, 8.5_
  
  - [x] 2.3 Add i18n to CreateFieldPage
    - Import and use `useTranslation` hook
    - Replace all text with translation keys (labels, buttons, placeholders, errors)
    - Use `t('forms.fields.key')` format for all strings
    - Ensure error messages use localized strings
    - _Requirements: 1.1, 1.4, 1.5_
  
  - [x] 2.4 Implement navigation handlers
    - Implement cancel button to navigate to `/forms/fields`
    - Implement success navigation to `/forms/fields` after field creation
    - Add success message display after navigation
    - _Requirements: 3.4, 3.5_

- [ ] 3. Create EditFieldPage component
  - [x] 3.1 Create EditFieldPage.tsx with form structure
    - Create new file at `packages/orgadmin-core/src/forms/pages/EditFieldPage.tsx`
    - Import necessary dependencies (React, MUI components, hooks, useParams)
    - Set up component state (same as CreateFieldPage plus loading state)
    - Implement form layout (same structure as CreateFieldPage)
    - Add breadcrumb navigation component
    - _Requirements: 4.1, 4.6_
  
  - [x] 3.2 Implement field loading and update logic
    - Extract field ID from URL params using `useParams`
    - Implement `loadField()` function to fetch field data by ID
    - Populate form inputs with loaded field data
    - Implement `handleUpdate()` function to submit field update via API
    - Add error handling for 404 errors (field not found)
    - Add error handling for API failures
    - _Requirements: 4.2, 4.7, 4.8_
  
  - [x] 3.3 Add i18n to EditFieldPage
    - Import and use `useTranslation` hook
    - Replace all text with translation keys
    - Use `t('forms.fields.key')` format for all strings
    - Ensure error messages use localized strings
    - _Requirements: 1.1, 1.4, 1.5_
  
  - [x] 3.4 Implement navigation handlers
    - Implement cancel button to navigate to `/forms/fields`
    - Implement success navigation to `/forms/fields` after field update
    - Implement error navigation to `/forms/fields` for 404 errors
    - Add success message display after navigation
    - _Requirements: 4.4, 4.5, 4.8_

- [x] 4. Update forms module routing
  - Add route for `/forms/fields/new` pointing to CreateFieldPage
  - Add route for `/forms/fields/:id/edit` pointing to EditFieldPage
  - Export CreateFieldPage and EditFieldPage from module index
  - Update module registration in `packages/orgadmin-core/src/forms/index.ts`
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 5. Update FieldsListPage to use new pages
  - [x] 5.1 Remove dialog components and state
    - Remove CreateFieldDialog and EditFieldDialog component code
    - Remove dialog state variables (createDialogOpen, editDialogOpen, selectedField)
    - Remove dialog handler functions (openCreateDialog, openEditDialog, handleCreateField, handleEditField)
    - Keep delete dialog functionality unchanged
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 5.2 Update navigation handlers
    - Update "Create Field" button to navigate to `/forms/fields/new`
    - Update edit icon click handler to navigate to `/forms/fields/:id/edit`
    - Import and use `useNavigate` hook from react-router-dom
    - _Requirements: 3.3, 4.3, 6.5_
  
  - [x] 5.3 Add i18n to FieldsListPage
    - Import and use `useTranslation` hook
    - Replace all hardcoded strings with translation keys
    - Update table headers, buttons, filters, empty states
    - Use `t('forms.fields.key')` format for all strings
    - _Requirements: 2.1, 2.4, 2.5_

- [ ] 6. Update FormBuilderPage with i18n
  - [x] 6.1 Add i18n to FormBuilderPage main content
    - Import and use `useTranslation` hook
    - Replace page title with `t('forms.builder.title')`
    - Replace form detail labels with translation keys
    - Replace button labels (Save, Cancel) with translation keys
    - _Requirements: 1.1, 1.5_
  
  - [x] 6.2 Add i18n to FormBuilderPage tabs and sections
    - Replace tab labels (Fields, Field Groups, Wizard Steps) with translation keys
    - Replace section titles with translation keys
    - Replace empty state messages with translation keys
    - Replace button labels (Add Field, Add Group, Add Step) with translation keys
    - _Requirements: 1.1, 1.5_
  
  - [x] 6.3 Add i18n to FormBuilderPage dialogs
    - Replace AddFieldDialog title and labels with translation keys
    - Replace AddGroupDialog title and labels with translation keys
    - Replace AddWizardStepDialog title and labels with translation keys
    - Replace all button labels in dialogs with translation keys
    - _Requirements: 1.1, 1.5_
  
  - [x] 6.4 Add i18n to FormBuilderPage error messages
    - Replace validation error messages with translation keys
    - Replace API error messages with translation keys
    - Use `t('forms.builder.validation.key')` format
    - _Requirements: 1.4_

- [x] 7. Checkpoint - Verify implementation
  - Ensure all new pages render correctly
  - Ensure all navigation flows work
  - Ensure all translations display correctly in English
  - Ensure no TypeScript errors
  - Ask the user if questions arise

- [ ] 8. Test translation completeness
  - [x] 8.1 Verify all translation keys exist in all language files
    - Check that all keys under `forms.fields` exist in all 6 language files
    - Check that all keys under `forms.builder` exist in all 6 language files
    - Verify no missing keys in any language file
    - _Requirements: 1.3, 2.3, 7.4_
  
  - [x] 8.2 Test UI in multiple languages
    - Test CreateFieldPage in at least 2 languages
    - Test EditFieldPage in at least 2 languages
    - Test FieldsListPage in at least 2 languages
    - Test FormBuilderPage in at least 2 languages
    - Verify all text displays correctly without English fallbacks
    - _Requirements: 1.2, 2.2_

- [ ] 9. Test navigation flows
  - [x] 9.1 Test create field flow
    - Navigate to `/forms/fields/new` from list page
    - Fill in form and submit
    - Verify navigation back to list page
    - Verify success message displays
    - _Requirements: 3.1, 3.3, 3.4_
  
  - [x] 9.2 Test edit field flow
    - Navigate to `/forms/fields/:id/edit` from list page
    - Verify field data loads correctly
    - Modify form and submit
    - Verify navigation back to list page
    - Verify success message displays
    - _Requirements: 4.1, 4.3, 4.4_
  
  - [x] 9.3 Test cancel navigation
    - Navigate to create page and click cancel
    - Verify navigation back to list page
    - Navigate to edit page and click cancel
    - Verify navigation back to list page
    - _Requirements: 3.5, 4.5_
  
  - [x] 9.4 Test error handling
    - Navigate to `/forms/fields/invalid-id/edit`
    - Verify error message displays
    - Verify navigation option back to list
    - _Requirements: 4.8_

- [ ] 10. Test validation and functionality
  - [x] 10.1 Test field creation validation
    - Try to create field with empty label
    - Verify error message displays
    - Try to create select field without options
    - Verify error message displays
    - Create valid field and verify success
    - _Requirements: 3.7, 8.5_
  
  - [x] 10.2 Test field editing validation
    - Try to update field with empty label
    - Verify error message displays
    - Try to update select field to have no options
    - Verify error message displays
    - Update valid field and verify success
    - _Requirements: 4.7, 8.5_
  
  - [x] 10.3 Test existing functionality preservation
    - Create a form using FormBuilderPage
    - Add fields, field groups, and wizard steps
    - Verify all features work correctly
    - Verify field types and options work correctly
    - Verify existing forms and fields still load
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all manual tests pass
  - Ensure no console errors or warnings
  - Ensure all translations display correctly in all 6 languages
  - Ensure all navigation flows work correctly
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Translation keys follow the structure defined in the design document
- The implementation preserves all existing functionality while adding i18n and improving navigation UX
