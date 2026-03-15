# Bugfix Requirements Document

## Introduction

The membership application forms (CreateMemberPage and EditMemberPage) have a critical bug where uploaded files are being stored as empty objects `[{},{}]` in the database instead of proper file metadata. This occurs because browser File objects are being directly JSON-stringified, which results in empty objects since File objects are not plain JavaScript objects. The existing file upload infrastructure (S3 upload endpoints and FileUploadService) is in place but not being utilized by the membership forms.

This bug prevents users from:
- Viewing uploaded file names and sizes in member details
- Downloading previously uploaded files
- Editing members with file attachments properly

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user uploads files through DocumentUploadRenderer in CreateMemberPage or EditMemberPage THEN the system stores File objects directly in the form submission data

1.2 WHEN the form is submitted with File objects THEN the system JSON-stringifies the File objects which serialize to empty objects `{}`

1.3 WHEN the submission_data is stored in the database THEN files are persisted as `[{},{}]` instead of file metadata

1.4 WHEN viewing member details with uploaded files THEN the system displays "NaN MB" with no file name

1.5 WHEN editing a member with previously uploaded files THEN the system cannot retrieve or display the file information properly

### Expected Behavior (Correct)

2.1 WHEN a user uploads files through DocumentUploadRenderer in CreateMemberPage or EditMemberPage THEN the system SHALL upload the files to S3 via the `/api/orgadmin/files/upload` endpoint

2.2 WHEN files are successfully uploaded to S3 THEN the system SHALL receive file metadata (fileId, fileName, fileSize, mimeType, url) from the upload endpoint

2.3 WHEN the form is submitted with uploaded files THEN the system SHALL store the file metadata objects in submission_data instead of File objects

2.4 WHEN viewing member details with uploaded files THEN the system SHALL display proper file names, sizes, and provide download links

2.5 WHEN editing a member with previously uploaded files THEN the system SHALL load and display the file metadata correctly with functional download links

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits a form without file uploads THEN the system SHALL CONTINUE TO save the form data correctly

3.2 WHEN a user fills out non-file fields in CreateMemberPage or EditMemberPage THEN the system SHALL CONTINUE TO store those field values correctly in submission_data

3.3 WHEN viewing or editing members without file attachments THEN the system SHALL CONTINUE TO function normally

3.4 WHEN using DocumentUploadRenderer in other parts of the application THEN the system SHALL CONTINUE TO function as currently implemented

3.5 WHEN the file upload endpoints receive requests from other features THEN the system SHALL CONTINUE TO process them correctly
