-- Agrega traccion por anuncio (solo aplica a camionetas)
-- Ejecutar en Supabase SQL editor

BEGIN;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS drivetrain TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_drivetrain_check'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_drivetrain_check
      CHECK (drivetrain IS NULL OR drivetrain IN ('4x2', '4x4'));
  END IF;
END $$;

COMMIT;
