-- Migration: Add accepts_trade column to vehicles table
-- Date: 2026-03-21

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS accepts_trade BOOLEAN DEFAULT false;
