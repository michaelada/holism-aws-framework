-- Migration: Create slot_reservations table
-- Description: Stores admin-reserved time slots to block availability for account users

CREATE TABLE IF NOT EXISTS slot_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  reserved_by UUID NOT NULL,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(calendar_id, slot_date, start_time, duration)
);

CREATE INDEX IF NOT EXISTS idx_slot_reservations_calendar_date
  ON slot_reservations(calendar_id, slot_date);
