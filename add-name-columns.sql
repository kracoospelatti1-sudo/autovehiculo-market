-- Migración: agregar nombre y apellido a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '';
