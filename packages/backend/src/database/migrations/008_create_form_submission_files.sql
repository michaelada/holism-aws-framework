-- Migration 008: Update form_submission_files table for file upload storage fix
-- This migration adds columns needed to track files uploaded before form submission
-- Files are uploaded immediately when selected, so we need organization_id and form_id
-- instead of relying only on submission_id (which doesn't exist yet at upload time)

-- Add organization_id and form_id columns
ALTER TABLE form_submission_files 
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE form_submission_files 
  ADD COLUMN IF NOT EXISTS form_id UUID;

-- Make submission_id nullable since files are uploaded before submission
ALTER TABLE form_submission_files 
  ALTER COLUMN submission_id DROP NOT NULL;

-- Add mime_type column (standardize on mime_type instead of file_type)
ALTER TABLE form_submission_files 
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255);

-- Copy existing file_type values to mime_type for backwards compatibility
UPDATE form_submission_files 
  SET mime_type = file_type 
  WHERE mime_type IS NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_form_submission_files_organization_id 
  ON form_submission_files(organization_id);

CREATE INDEX IF NOT EXISTS idx_form_submission_files_form_id 
  ON form_submission_files(form_id);

-- Add comments
COMMENT ON COLUMN form_submission_files.organization_id IS 'Organization that owns this file (set at upload time)';
COMMENT ON COLUMN form_submission_files.form_id IS 'Form that this file belongs to (set at upload time)';
COMMENT ON COLUMN form_submission_files.submission_id IS 'Form submission this file is associated with (set after form submission, nullable for orphaned files)';
COMMENT ON COLUMN form_submission_files.mime_type IS 'MIME type of the file (e.g., application/pdf, image/jpeg)';
