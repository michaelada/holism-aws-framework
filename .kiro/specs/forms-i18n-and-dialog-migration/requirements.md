# Requirements Document

## Introduction

This feature addresses two key improvements to the Forms module in the OrgAdmin application:
1. Internationalization (i18n) of Form Builder pages to support the application's 6 languages
2. Migration of field creation and editing dialogs to dedicated pages for better UX and consistency

The Forms module currently has hardcoded English text in several pages, and uses popup dialogs for field management. This feature will bring the Forms module in line with the rest of the application's i18n standards and navigation patterns.

## Glossary

- **Form_Builder**: The system component that allows administrators to create and edit application forms
- **Field_Definition**: A reusable field specification that can be added to multiple forms
- **Translation_Key**: A unique identifier used to retrieve localized text from translation files
- **i18n**: Internationalization - the process of designing software to support multiple languages
- **Dialog**: A popup modal window overlaying the current page
- **Page**: A full-screen view with its own route and navigation

## Requirements

### Requirement 1: Internationalize FormBuilderPage

**User Story:** As an organization administrator, I want the Form Builder page to display in my organization's configured language, so that I can create and edit forms in my preferred language.

#### Acceptance Criteria

1. WHEN FormBuilderPage renders, THE System SHALL display all UI text using translation keys instead of hardcoded English strings
2. WHEN the user's locale changes, THE FormBuilderPage SHALL update all displayed text to match the new locale
3. THE System SHALL provide translations for all FormBuilderPage text in all 6 supported languages (en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT)
4. WHEN FormBuilderPage displays validation errors, THE System SHALL show localized error messages
5. WHEN FormBuilderPage displays button labels, THE System SHALL use translated text for all buttons (Save, Cancel, Add Field, etc.)

### Requirement 2: Internationalize FieldsListPage

**User Story:** As an organization administrator, I want the Field Definitions page to display in my organization's configured language, so that I can manage field definitions in my preferred language.

#### Acceptance Criteria

1. WHEN FieldsListPage renders, THE System SHALL display all UI text using translation keys instead of hardcoded English strings
2. WHEN the user's locale changes, THE FieldsListPage SHALL update all displayed text to match the new locale
3. THE System SHALL provide translations for all FieldsListPage text in all 6 supported languages (en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT)
4. WHEN FieldsListPage displays the field type filter, THE System SHALL show localized field type names
5. WHEN FieldsListPage displays empty states, THE System SHALL show localized messages

### Requirement 3: Create CreateFieldPage

**User Story:** As an organization administrator, I want to create field definitions on a dedicated page instead of a dialog, so that I have more space and better navigation context.

#### Acceptance Criteria

1. WHEN a user navigates to `/forms/fields/new`, THE System SHALL display the CreateFieldPage
2. WHEN CreateFieldPage renders, THE System SHALL display a form with all field definition inputs (label, description, type, options)
3. WHEN a user clicks "Create Field" button on FieldsListPage, THE System SHALL navigate to `/forms/fields/new`
4. WHEN a user successfully creates a field, THE System SHALL navigate back to `/forms/fields` and display a success message
5. WHEN a user clicks Cancel on CreateFieldPage, THE System SHALL navigate back to `/forms/fields`
6. THE CreateFieldPage SHALL include breadcrumb navigation showing the path from Fields List to Create Field
7. THE CreateFieldPage SHALL validate all inputs before submission and display localized error messages

### Requirement 4: Create EditFieldPage

**User Story:** As an organization administrator, I want to edit field definitions on a dedicated page instead of a dialog, so that I have more space and better navigation context.

#### Acceptance Criteria

1. WHEN a user navigates to `/forms/fields/:id/edit`, THE System SHALL display the EditFieldPage with the field's current data
2. WHEN EditFieldPage renders, THE System SHALL load the existing field data and populate all form inputs
3. WHEN a user clicks the Edit icon for a field on FieldsListPage, THE System SHALL navigate to `/forms/fields/:id/edit`
4. WHEN a user successfully updates a field, THE System SHALL navigate back to `/forms/fields` and display a success message
5. WHEN a user clicks Cancel on EditFieldPage, THE System SHALL navigate back to `/forms/fields`
6. THE EditFieldPage SHALL include breadcrumb navigation showing the path from Fields List to Edit Field
7. THE EditFieldPage SHALL validate all inputs before submission and display localized error messages
8. WHEN EditFieldPage loads a non-existent field ID, THE System SHALL display an error message and provide navigation back to the fields list

### Requirement 5: Update Module Routing

**User Story:** As a developer, I want the Forms module routing to include the new field pages, so that users can navigate to them via URL.

#### Acceptance Criteria

1. THE System SHALL register the route `/forms/fields/new` pointing to CreateFieldPage
2. THE System SHALL register the route `/forms/fields/:id/edit` pointing to EditFieldPage
3. WHEN a user bookmarks a field edit page URL, THE System SHALL navigate directly to that page when the bookmark is accessed
4. THE System SHALL export CreateFieldPage and EditFieldPage from the forms module index

### Requirement 6: Remove Field Dialogs from FieldsListPage

**User Story:** As a developer, I want to remove the dialog-based field creation and editing from FieldsListPage, so that the codebase uses consistent navigation patterns.

#### Acceptance Criteria

1. WHEN FieldsListPage renders, THE System SHALL not display create or edit field dialogs
2. THE System SHALL remove all dialog state management code related to field creation and editing from FieldsListPage
3. THE System SHALL remove the CreateFieldDialog and EditFieldDialog components from FieldsListPage
4. THE System SHALL preserve the delete field dialog functionality in FieldsListPage
5. WHEN a user clicks "Create Field" button, THE System SHALL navigate to the CreateFieldPage instead of opening a dialog

### Requirement 7: Maintain Translation Consistency

**User Story:** As a developer, I want all form-related translations to follow consistent naming patterns, so that the translation files are maintainable and predictable.

#### Acceptance Criteria

1. THE System SHALL organize all form-related translations under the `forms` namespace
2. THE System SHALL use consistent key naming patterns matching existing translations (e.g., `forms.fields.title`, `forms.fields.createField`)
3. THE System SHALL reuse common translation keys from the `common` namespace where applicable (e.g., `common.actions.save`, `common.actions.cancel`)
4. THE System SHALL provide translations for all new keys in all 6 supported languages
5. WHEN adding new translation keys, THE System SHALL follow the existing hierarchical structure in translation files

### Requirement 8: Preserve Existing Functionality

**User Story:** As an organization administrator, I want all existing form builder functionality to continue working after the migration, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHEN creating or editing forms, THE System SHALL maintain all existing form builder features (field groups, wizard steps, field ordering)
2. WHEN managing field definitions, THE System SHALL maintain all existing field type options and validation rules
3. THE System SHALL preserve all existing API endpoints and data structures
4. THE System SHALL maintain backward compatibility with existing form and field data
5. WHEN field options are required for certain field types (select, multiselect, radio, checkbox), THE System SHALL continue to validate and enforce this requirement
