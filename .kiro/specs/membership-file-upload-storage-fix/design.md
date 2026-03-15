# Membership File Upload Storage Fix - Bugfix Design

## Overview

The membership application forms currently store File objects directly in submission_data, which JSON-stringify to empty objects `[{},{}]`. This design addresses the bug by integrating the existing file upload infrastructure (`/api/orgadmin/files/upload` endpoint and FileUploadService) with CreateMemberPage and EditMemberPage. Files will be uploaded to S3 immediately when selected, and only file metadata (fileId, fileName, fileSize, mimeType, url) will be stored in submission_data. This ensures files are properly persisted, retrievable, and displayable.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when DocumentUploadRenderer returns File objects that get JSON-stringified to empty objects
- **Property (P)**: The desired behavior - files should be uploaded to S3 and metadata stored in submission_data
- **Preservation**: Existing form submission behavior for non-file fields must remain unchanged
- **File Metadata**: The structured data stored in submission_data: `{fileId, fileName, fileSize, mimeType, url}`
- **DocumentUploadRenderer**: The component in `packages/components/src/components/FieldRenderer/renderers/DocumentUploadRenderer.tsx` that handles file selection
- **submission_data**: The JSONB column in form_submissions table that stores all form field values
- **form_submission_files**: Database table that stores file metadata with S3 keys for retrieval

## Bug Details

### Fault Condition

The bug manifests when a user uploads files through DocumentUploadRenderer in CreateMemberPage or EditMemberPage. The DocumentUploadRenderer component returns browser File objects in its onChange callback. These File objects are stored directly in the formData state and then included in submission_data when the form is submitted. During JSON serialization, File objects (which are not plain JavaScript objects) serialize to empty objects `{}`, resulting in `[{},{}]` being stored in the database.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type FormFieldValue
  OUTPUT: boolean
  
  RETURN input.fieldType == 'document_upload'
         AND input.value CONTAINS File objects
         AND formSubmission.submissionData[input.fieldName] IS serialized
END FUNCTION
```

### Examples

- **Example 1**: User uploads "passport.pdf" (2.5 MB) in CreateMemberPage → submission_data stores `[{}]` → member details show "NaN MB" with no filename
- **Example 2**: User uploads two files "id_card.jpg" and "proof_of_address.pdf" in EditMemberPage → submission_data stores `[{},{}]` → files cannot be retrieved or downloaded
- **Example 3**: User edits a member with previously uploaded files → DocumentUploadRenderer receives `[{},{}]` → cannot display file information
- **Edge Case**: User uploads file, then cancels form submission → file should be cleaned up from S3 (orphaned file handling)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Non-file form fields (text, number, date, select, etc.) must continue to be stored correctly in submission_data
- Form validation for non-file fields must continue to work as before
- Form submission flow for forms without file uploads must remain unchanged
- DocumentUploadRenderer behavior in other parts of the application (e.g., BrandingTab) must remain unchanged
- File upload endpoints must continue to work for other features

**Scope:**
All inputs that do NOT involve document_upload fields should be completely unaffected by this fix. This includes:
- Text, textarea, number, email, phone fields
- Date, time, datetime fields
- Boolean, select, multiselect, radio, checkbox fields
- Form submissions without any file uploads
- Other features using the file upload infrastructure

## Hypothesized Root Cause

Based on the bug description, the root cause is:

1. **Direct File Object Storage**: CreateMemberPage and EditMemberPage store File objects directly in formData state without uploading them to S3
   - File objects come from DocumentUploadRenderer's onChange callback
   - These File objects are included in submission_data payload

2. **JSON Serialization Issue**: When the form is submitted, the entire formData object (including File objects) is JSON-stringified
   - File objects are not plain JavaScript objects
   - JSON.stringify(new File(...)) produces `{}`
   - Arrays of File objects become `[{},{}]`

3. **Missing Upload Integration**: The existing `/api/orgadmin/files/upload` endpoint is not being called by the membership forms
   - BrandingTab correctly uploads files immediately when selected
   - Membership forms do not implement this pattern

4. **No File Metadata Transformation**: There is no code to transform File objects into file metadata before form submission
   - No fileId, fileName, fileSize, mimeType, url structure
   - No reference to uploaded files in S3

## Correctness Properties

Property 1: Fault Condition - File Upload and Metadata Storage

_For any_ form submission where a document_upload field contains File objects, the fixed code SHALL upload each file to S3 via `/api/orgadmin/files/upload`, receive file metadata from the endpoint, and store the metadata objects (not File objects) in submission_data, enabling proper file retrieval and display.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Non-File Field Behavior

_For any_ form submission where fields do NOT contain File objects (text, number, date, select, etc.), the fixed code SHALL produce exactly the same submission_data as the original code, preserving all existing form submission behavior for non-file fields.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `packages/backend/src/services/file-upload.service.ts`

**Changes**:

1. **Update S3 Key Structure**: Modify `generateS3Key` method to use improved folder structure
   - Current: `organizationId/formId/fieldId/filename`
   - New: `uploads/organizationId/formId/fieldId/filename`
   - This groups all uploaded files under `uploads/` folder
   - Within uploads, files are organized by organization for easy discovery
   - Maintains existing formId/fieldId structure for granular organization
   - Example: `uploads/org-123/form-abc/field-xyz/consent_1234567890_a1b2c3d4.pdf`

**Rationale**: The `uploads/` prefix provides a clear top-level namespace for all user-uploaded files, making it easy to:
- Distinguish uploaded files from other S3 objects (e.g., system files, backups)
- Apply S3 bucket policies or lifecycle rules specifically to uploaded files
- Browse and manage files by organization in the S3 console
- Implement organization-level quotas or access controls

**File 2**: `packages/orgadmin-memberships/src/pages/CreateMemberPage.tsx`

**Changes**:

1. **Add File Upload Handler**: Create `uploadFileToS3` function that calls `/api/orgadmin/files/upload`
   - Accept File object, organizationId, formId, fieldId
   - Use FormData with multipart/form-data
   - Return file metadata: `{fileId, fileName, fileSize, mimeType, url}`
   - Handle upload errors with user-friendly messages

2. **Modify Field Change Handler**: Update the onChange callback in `renderField` for document_upload fields
   - Detect when field datatype is 'document_upload'
   - When File objects are received, immediately upload them to S3
   - Replace File objects with file metadata in formData state
   - Show upload progress indicator during upload
   - Handle upload failures gracefully

3. **Add File Metadata Type**: Define TypeScript interface for file metadata
   ```typescript
   interface FileMetadata {
     fileId: string;
     fileName: string;
     fileSize: number;
     mimeType: string;
     url: string;
   }
   ```

4. **Update Form Submission**: Ensure submission_data contains file metadata, not File objects
   - No changes needed if file upload happens in onChange handler
   - Verify formData contains only serializable data before submission

5. **Add Orphaned File Cleanup**: Track uploaded fileIds and delete them if form submission fails
   - Store uploaded fileIds in component state
   - On submission failure, call DELETE `/api/orgadmin/files/:fileId` for each uploaded file
   - Clear fileIds list on successful submission

**File 3**: `packages/orgadmin-memberships/src/pages/EditMemberPage.tsx`

**Changes**: Same as CreateMemberPage (1-5 above)

**File 4**: `packages/components/src/components/FieldRenderer/renderers/DocumentUploadRenderer.tsx`

**Changes**: 

1. **Support File Metadata Display**: Update to handle both File objects and file metadata objects
   - Modify `value` prop type to accept `File[] | FileMetadata[] | (File | FileMetadata)[]`
   - Update `getFileName` to extract name from metadata: `file.fileName || file.name`
   - Update `getFileSize` to use metadata: `file.fileSize || file.size`
   - Update `isUrl` check to detect metadata objects: `typeof file === 'object' && 'fileId' in file`

2. **Add Download Link for Metadata**: When displaying file metadata, show download link
   - Use `file.url` from metadata for download
   - Open in new tab with `target="_blank"`

3. **Preserve Existing Behavior**: Ensure File object handling remains unchanged for other features
   - Keep all existing File object logic
   - Add conditional logic to detect metadata vs File objects

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that create members with file uploads, inspect the database submission_data, and assert that File objects are being stored as empty objects. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Single File Upload Test**: Upload one file in CreateMemberPage, submit form, query database for submission_data (will show `[{}]` on unfixed code)
2. **Multiple File Upload Test**: Upload two files in CreateMemberPage, submit form, query database for submission_data (will show `[{},{}]` on unfixed code)
3. **Edit Member File Upload Test**: Edit existing member, upload file, submit form, query database (will show `[{}]` on unfixed code)
4. **Member Details Display Test**: Create member with file, view member details page (will show "NaN MB" with no filename on unfixed code)

**Expected Counterexamples**:
- Database contains `[{}]` or `[{},{}]` instead of file metadata
- Possible causes: File objects being JSON-stringified, no S3 upload happening, no metadata transformation

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (document_upload fields with File objects), the fixed function produces the expected behavior (files uploaded to S3, metadata stored).

**Pseudocode:**
```
FOR ALL formSubmission WHERE hasDocumentUploadField(formSubmission) DO
  result := submitForm_fixed(formSubmission)
  ASSERT filesUploadedToS3(result)
  ASSERT submissionDataContainsMetadata(result)
  ASSERT filesDownloadable(result)
END FOR
```

**Test Plan**: Write tests that upload files through the fixed CreateMemberPage/EditMemberPage, verify files are uploaded to S3, verify submission_data contains metadata, verify files can be downloaded.

**Test Cases**:
1. **Single File Upload - Fixed**: Upload file, verify S3 upload called, verify metadata in submission_data
2. **Multiple Files Upload - Fixed**: Upload multiple files, verify all uploaded to S3, verify metadata array in submission_data
3. **File Download - Fixed**: Create member with file, retrieve member, verify download URL works
4. **Edit Member File Display - Fixed**: Edit member with existing files, verify files displayed with correct names and sizes
5. **Orphaned File Cleanup - Fixed**: Upload file, cancel form submission, verify file deleted from S3

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (non-file fields), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL formSubmission WHERE NOT hasDocumentUploadField(formSubmission) DO
  ASSERT submitForm_original(formSubmission) = submitForm_fixed(formSubmission)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-file inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-file form submissions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Text Field Preservation**: Create member with only text fields, verify submission_data identical to unfixed code
2. **Date Field Preservation**: Create member with date fields, verify submission_data identical to unfixed code
3. **Select Field Preservation**: Create member with select/multiselect fields, verify submission_data identical to unfixed code
4. **Mixed Fields Preservation**: Create member with text, number, date, select fields (no files), verify submission_data identical to unfixed code

### Unit Tests

- Test `uploadFileToS3` function with valid File object, verify correct API call
- Test `uploadFileToS3` function with upload failure, verify error handling
- Test onChange handler for document_upload field, verify File objects replaced with metadata
- Test form submission with file metadata, verify submission_data structure
- Test orphaned file cleanup on submission failure, verify DELETE API calls
- Test DocumentUploadRenderer with file metadata, verify correct display
- Test DocumentUploadRenderer with File objects, verify existing behavior preserved

### Property-Based Tests

- Generate random form configurations with/without document_upload fields, verify correct handling
- Generate random file uploads (various sizes, types), verify all uploaded correctly
- Generate random form submissions without files, verify submission_data unchanged from original behavior
- Generate random edit scenarios with existing files, verify files displayed and downloadable

### Integration Tests

- Test full create member flow with file upload: select file → upload → submit → verify in database → view member details → download file
- Test full edit member flow with file upload: load member with files → display files → add new file → submit → verify updated
- Test form submission failure with uploaded files: upload files → trigger validation error → cancel form → verify files cleaned up from S3
- Test switching between membership types with different form fields including file uploads
