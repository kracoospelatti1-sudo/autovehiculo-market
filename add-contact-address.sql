-- Agrega columna contact_address a vehicles
-- Permite definir una direccion personalizada por publicacion
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS contact_address TEXT DEFAULT NULL;
