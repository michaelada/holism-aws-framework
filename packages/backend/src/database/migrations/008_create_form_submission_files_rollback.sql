-- Rollback Migration 008: Remove columns added for file upload storage fix

-- Remove indexes
DROP INDEX IF EXISTS idx_form_submission_files_organization_id;
DROP INDEX IF EXISTS idx_form_submission_files_form_id;

-- Remove columns
ALTER TABLE form_submission_files DROP COLUMN IF EXISTS organization_id;
ALTER TABLE form_submission_files DROP COLUMN IF EXISTS form_id;
ALTER TABLE form_submission_files DROP COLUMN IF EXISTS mime_type;

-- Restore submission_id as NOT NULL
ALTER TABLE form_submission_files ALTER COLUMN submission_id SET NOT NULL;
