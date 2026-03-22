-- Guardar precio original del vendedor (sin convertir)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price_original NUMERIC;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) DEFAULT 'USD';
