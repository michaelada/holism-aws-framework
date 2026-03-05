# Requirements Document

## Introduction

This document specifies requirements for consolidating three separate document management capabilities into a single unified capability and implementing capability-based visibility for file upload field types in the form builder. Currently, the system has three separate capabilities: "membership-document-management", "event-document-management", and "registration-document-management". These will be consolidated into a single "document-management" capability that controls access to file and image upload field types across all modules.

## Glossary

- **Capability**: A feature or functionality that can be enabled or disabled for an organization
- **Field_Type**: The data type of a form field (text, number, file, image, etc.)
- **Form_Builder**: The UI component that allows users to create and edit field definitions
- **Field_Definition**: A configuration object that defines a custom form field
- **Organization**: An entity that uses the system and has specific capabilities enabled
- **Migration**: A database script that modifies the database schema or data
- **CreateFieldPage**: The page component for creating new field definitions
- **EditFieldPage**: The page component for editing existing field definitions
- **Backend_Validator**: Server-side validation logic that enforces business rules
- **Document_Upload_Field**: A field type that allows users to upload files or images (file or image datatype)

## Requirements

### Requirement 1: Consolidate Document Management Capabilities

**User Story:** As a system administrator, I want a single unified document management capability, so that capability management is simpler and more consistent across all modules.

#### Acceptance Criteria

1. THE System SHALL create a new capability named "document-management" with display name "Document Management" and description "Manage document uploads across all modules"
2. THE System SHALL mark the capability "document-management" as category "additional-feature"
3. THE System SHALL remove the capability "membership-document-management" from the capabilities table
4. THE System SHALL remove the capability "event-document-management" from the capabilities table
5. THE System SHALL remove the capability "registration-document-management" from the capabilities table

### Requirement 2: Migrate Existing Organization Capabilities

**User Story:** As an existing organization with document management capabilities, I want my capabilities automatically migrated to the new consolidated capability, so that I don't lose access to document upload functionality.

#### Acceptance Criteria

1. WHEN an organization has "membership-document-management" enabled, THE Migration SHALL add "document-management" to the organization's enabled capabilities
2. WHEN an organization has "event-document-management" enabled, THE Migration SHALL add "document-management" to the organization's enabled capabilities
3. WHEN an organization has "registration-document-management" enabled, THE Migration SHALL add "document-management" to the organization's enabled capabilities
4. WHEN an organization has multiple old document management capabilities enabled, THE Migration SHALL add "document-management" exactly once to the organization's enabled capabilities
5. THE Migration SHALL remove "membership-document-management" from all organizations' enabled capabilities
6. THE Migration SHALL remove "event-document-management" from all organizations' enabled capabilities
7. THE Migration SHALL remove "registration-document-management" from all organizations' enabled capabilities

### Requirement 3: Filter Field Types Based on Capability

**User Story:** As an organization administrator, I want to see only the field types my organization has access to, so that I don't attempt to create fields that require capabilities I don't have.

#### Acceptance Criteria

1. WHEN an organization has the "document-management" capability, THE CreateFieldPage SHALL display "file" in the field type dropdown
2. WHEN an organization has the "document-management" capability, THE CreateFieldPage SHALL display "image" in the field type dropdown
3. WHEN an organization does NOT have the "document-management" capability, THE CreateFieldPage SHALL NOT display "file" in the field type dropdown
4. WHEN an organization does NOT have the "document-management" capability, THE CreateFieldPage SHALL NOT display "image" in the field type dropdown
5. WHEN an organization has the "document-management" capability, THE EditFieldPage SHALL display "file" in the field type dropdown
6. WHEN an organization has the "document-management" capability, THE EditFieldPage SHALL display "image" in the field type dropdown
7. WHEN an organization does NOT have the "document-management" capability, THE EditFieldPage SHALL NOT display "file" in the field type dropdown
8. WHEN an organization does NOT have the "document-management" capability, THE EditFieldPage SHALL NOT display "image" in the field type dropdown
9. FOR ALL non-document field types, THE CreateFieldPage SHALL display them in the field type dropdown regardless of capabilities
10. FOR ALL non-document field types, THE EditFieldPage SHALL display them in the field type dropdown regardless of capabilities

### Requirement 4: Backend Validation for Document Upload Fields

**User Story:** As a system administrator, I want the backend to validate capability requirements, so that organizations cannot bypass frontend restrictions to create unauthorized field types.

#### Acceptance Criteria

1. WHEN an organization without "document-management" capability attempts to create a field with datatype "file", THE Backend_Validator SHALL return an HTTP 403 error
2. WHEN an organization without "document-management" capability attempts to create a field with datatype "image", THE Backend_Validator SHALL return an HTTP 403 error
3. WHEN an organization without "document-management" capability attempts to update a field to datatype "file", THE Backend_Validator SHALL return an HTTP 403 error
4. WHEN an organization without "document-management" capability attempts to update a field to datatype "image", THE Backend_Validator SHALL return an HTTP 403 error
5. WHEN an organization with "document-management" capability creates a field with datatype "file", THE Backend_Validator SHALL allow the operation
6. WHEN an organization with "document-management" capability creates a field with datatype "image", THE Backend_Validator SHALL allow the operation
7. WHEN an organization with "document-management" capability updates a field to datatype "file", THE Backend_Validator SHALL allow the operation
8. WHEN an organization with "document-management" capability updates a field to datatype "image", THE Backend_Validator SHALL allow the operation
9. THE Backend_Validator SHALL return a descriptive error message indicating the missing capability when validation fails

### Requirement 5: Handle Existing Document Upload Fields

**User Story:** As an organization with existing file or image fields, I want my existing fields to continue working after the migration, so that my forms don't break.

#### Acceptance Criteria

1. THE Migration SHALL preserve all existing Field_Definition records with datatype "file"
2. THE Migration SHALL preserve all existing Field_Definition records with datatype "image"
3. WHEN an organization has existing document upload fields but does NOT have "document-management" capability after migration, THE EditFieldPage SHALL allow viewing the field but prevent changing the datatype
4. WHEN an organization has existing document upload fields and has "document-management" capability, THE EditFieldPage SHALL allow full editing of the field including datatype changes

### Requirement 6: Migration Rollback Support

**User Story:** As a database administrator, I want the ability to rollback the migration, so that I can recover if issues are discovered after deployment.

#### Acceptance Criteria

1. THE Migration SHALL provide a down migration that restores the three original capabilities
2. WHEN the down migration executes, THE System SHALL create "membership-document-management" capability
3. WHEN the down migration executes, THE System SHALL create "event-document-management" capability
4. WHEN the down migration executes, THE System SHALL create "registration-document-management" capability
5. WHEN the down migration executes and an organization has "document-management" capability, THE System SHALL add all three original capabilities to the organization
6. WHEN the down migration executes, THE System SHALL remove "document-management" from all organizations' enabled capabilities
7. WHEN the down migration executes, THE System SHALL remove the "document-management" capability from the capabilities table

### Requirement 7: Organization Type Default Capabilities

**User Story:** As a system administrator configuring organization types, I want to specify whether new organizations should have document management enabled by default, so that I can control feature access at the organization type level.

#### Acceptance Criteria

1. WHEN an organization type has "document-management" in its default capabilities, THE System SHALL enable "document-management" for new organizations of that type
2. THE Migration SHALL update organization type default capabilities that contained any of the old document management capabilities to include "document-management"
3. THE Migration SHALL remove "membership-document-management" from all organization type default capabilities
4. THE Migration SHALL remove "event-document-management" from all organization type default capabilities
5. THE Migration SHALL remove "registration-document-management" from all organization type default capabilities
