-- Agrega body_type por anuncio individual
-- Ejecutar en Supabase SQL editor

BEGIN;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS body_type TEXT;

CREATE INDEX IF NOT EXISTS idx_vehicles_body_type
  ON public.vehicles (body_type);

COMMIT;
