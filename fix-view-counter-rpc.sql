-- Fix RPC ambiguity for increment_view_count
-- Run this in Supabase SQL editor.

BEGIN;

-- Remove overloaded signature that causes ambiguous RPC resolution.
DROP FUNCTION IF EXISTS public.increment_view_count(integer);

-- Keep a single canonical signature (bigint).
CREATE OR REPLACE FUNCTION public.increment_view_count(vehicle_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.vehicles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = vehicle_id;
END;
$$;

COMMIT;
