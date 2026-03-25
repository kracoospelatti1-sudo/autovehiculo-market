-- Cache local de tipo de carroceria por marca/modelo
-- Ejecutar en Supabase SQL editor

BEGIN;

CREATE TABLE IF NOT EXISTS public.vehicle_body_type_cache (
  id BIGSERIAL PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  normalized_brand TEXT NOT NULL,
  normalized_model TEXT NOT NULL,
  body_type TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'mercadolibre',
  source_item_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_body_type_cache_unique UNIQUE (normalized_brand, normalized_model)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_body_type_cache_lookup
  ON public.vehicle_body_type_cache (normalized_brand, normalized_model);

COMMIT;
