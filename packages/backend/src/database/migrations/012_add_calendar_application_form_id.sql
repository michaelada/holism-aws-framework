-- Migration: Add application_form_id column to calendars table
-- Description: Adds support for linking an application form to a calendar
-- The calendar service already references this column in INSERT/UPDATE SQL

ALTER TABLE calendars ADD COLUMN IF NOT EXISTS application_form_id VARCHAR(255) DEFAULT NULL;
