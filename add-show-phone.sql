-- Agrega columna show_phone a profiles
-- Por defecto TRUE: los usuarios existentes siguen mostrando su teléfono
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT TRUE;
