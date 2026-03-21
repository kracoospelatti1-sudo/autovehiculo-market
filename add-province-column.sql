-- Migration: Add province column to vehicles table
-- Date: 2026-03-21

-- Add province column
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS province VARCHAR(100) DEFAULT '';

-- Create index for filtering by province
CREATE INDEX IF NOT EXISTS idx_vehicles_province ON vehicles(province);

-- Backfill: For existing vehicles that have city stored as "Ciudad, Provincia" format,
-- try to extract the province. This is a best-effort migration.
-- The city field stays as-is (just the city name going forward).
-- No automatic backfill needed since old data was mixed format.
