-- Agrega columna para recordar que el usuario ya vio el banner de perfil 100% completo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_complete_seen BOOLEAN DEFAULT FALSE;
