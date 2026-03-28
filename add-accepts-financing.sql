-- Migration: Add accepts_financing column to vehicles table
-- Date: 2026-03-25

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS accepts_financing BOOLEAN DEFAULT false;
