-- Migration: Add deleted flag to events table
-- Date: 2024-01-29
-- Description: Adds soft delete support for events - marks events as deleted without removing data

-- Add deleted column with default false
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE NOT NULL;

-- Add deleted_at timestamp to track when event was deleted
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add deleted_by to track who deleted the event
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

-- Create index for efficient querying of non-deleted events
CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted) WHERE deleted = FALSE;

-- Add comments for documentation
COMMENT ON COLUMN events.deleted IS 'Soft delete flag - when true, event is hidden from UI but data is preserved';
COMMENT ON COLUMN events.deleted_at IS 'Timestamp when the event was marked as deleted';
COMMENT ON COLUMN events.deleted_by IS 'User ID who deleted the event';
