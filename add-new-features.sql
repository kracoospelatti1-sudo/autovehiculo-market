-- Migration: New features (2026-03-22)
-- 1. Vehicle version field
-- 2. Dealership fields for verified users (name, address, instagram)
-- 3. Vehicle views tracking per user (unique views)
-- 4. sold_at timestamp for grace period

-- === VEHICLES: version column ===
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '';

-- === VEHICLES: sold_at timestamp ===
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ DEFAULT NULL;

-- === PROFILES: dealership and instagram fields ===
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealership_name TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealership_address TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram TEXT DEFAULT '';

-- === VEHICLE VIEWS: unique views per user ===
DROP TABLE IF EXISTS vehicle_views CASCADE;
CREATE TABLE vehicle_views (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  viewer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicle_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_views_vehicle ON vehicle_views(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_views_viewer ON vehicle_views(viewer_id);

-- === Replace increment_view_count RPC to handle unique views ===
CREATE OR REPLACE FUNCTION increment_view_count(vehicle_id BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE vehicles SET view_count = view_count + 1 WHERE id = vehicle_id;
END;
$$ LANGUAGE plpgsql;

-- New function for unique view tracking
CREATE OR REPLACE FUNCTION track_unique_view(p_vehicle_id BIGINT, p_viewer_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  inserted BOOLEAN := FALSE;
BEGIN
  INSERT INTO vehicle_views (vehicle_id, viewer_id)
  VALUES (p_vehicle_id, p_viewer_id)
  ON CONFLICT (vehicle_id, viewer_id) DO NOTHING;

  IF FOUND THEN
    UPDATE vehicles SET view_count = view_count + 1 WHERE id = p_vehicle_id;
    inserted := TRUE;
  END IF;

  RETURN inserted;
END;
$$ LANGUAGE plpgsql;
