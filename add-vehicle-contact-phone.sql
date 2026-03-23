-- Agrega columna contact_phone a vehicles
-- Permite que admins especifiquen un número de contacto personalizado por publicación
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT NULL;
