# File Upload Field Description Display - Requirements

## Overview
File Upload and Image Upload field types in the FieldRenderer component do not display the description text from field definitions. This makes it difficult for users to understand what files are needed or expected when filling out forms.

## Problem Statement
The DocumentUploadRenderer component checks for `fieldDefinition.helpText` property, but the actual FieldDefinition type uses `fieldDefinition.description`. This mismatch causes the description text to never be displayed for File Upload and Image Upload fields, even when a description is defined.

## User Stories

### 1. As a form filler
**I want to** see the description text for File Upload and Image Upload fields  
**So that** I understand what type of file is expected and any requirements or guidelines

**Acceptance Criteria:**
- 1.1 When a File Upload field has a description defined, the description text is displayed below the field label
- 1.2 When an Image Upload field has a description defined, the description text is displayed below the field label
- 1.3 The description text uses appropriate styling (caption variant, secondary color) consistent with other field types
- 1.4 The description text appears before the file upload button
- 1.5 When no description is defined, no description text is displayed (graceful handling)

### 2. As a form designer
**I want to** provide helpful description text for file upload fields  
**So that** users know exactly what files to upload and any format/size requirements

**Acceptance Criteria:**
- 2.1 Description text defined in field definitions is properly displayed for document_upload datatype
- 2.2 The description can include guidance like "Upload a PDF or Word document (max 5MB)"
- 2.3 The description is visible in both form preview and actual form submission views

## Technical Context

### Current Implementation
- **Component:** `packages/components/src/components/FieldRenderer/renderers/DocumentUploadRenderer.tsx`
- **Issue:** Line 107-111 checks for `fieldDefinition.helpText` but should check `fieldDefinition.description`
- **Type Definition:** `packages/components/src/types/metadata.types.ts` defines `description: string` in FieldDefinition interface

### Related Components
- FieldRenderer: Main component that routes to DocumentUploadRenderer for document_upload datatype
- Other renderer components (TextRenderer, DateRenderer, etc.) for consistency reference

## Non-Functional Requirements

### Consistency
- The description display should match the styling and positioning used in other field renderer components
- Use MUI Typography component with variant="caption" and color="textSecondary"

### Accessibility
- Description text should be properly associated with the field for screen readers
- Consider using aria-describedby if appropriate

### Backward Compatibility
- The fix should not break existing forms or field definitions
- Should gracefully handle cases where description is undefined or empty

## Out of Scope
- Adding new description functionality to other field types (they already work correctly)
- Changing the FieldDefinition type structure
- Adding rich text or HTML support to descriptions
- Internationalization of description text (handled at field definition level)

## Success Metrics
- Description text displays correctly for all File Upload and Image Upload fields with descriptions defined
- No regression in other field types
- Consistent visual appearance with other field renderers
