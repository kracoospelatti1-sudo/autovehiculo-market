-- ============================================================
-- FIX: Agregar columnas faltantes a la tabla vehicles
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mileage INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel TEXT DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Crear la tabla vehicle_images si no existe
CREATE TABLE IF NOT EXISTS vehicle_images (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear la tabla de favoritos si no existe
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, vehicle_id)
);

-- Crear la tabla de conversaciones si no existe
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vehicle_id, buyer_id)
);

-- Crear la tabla de mensajes si no existe
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear la tabla de notificaciones si no existe
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear la tabla de ratings si no existe
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  stars INTEGER CHECK (stars >= 1 AND stars <= 5),
  review TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_user_id, to_user_id, vehicle_id)
);

-- Crear la tabla de reportes si no existe
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear la tabla de perfiles si no existe
CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  phone TEXT DEFAULT '',
  city TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Función para incrementar vistas
CREATE OR REPLACE FUNCTION increment_view_count(vehicle_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE vehicles SET view_count = view_count + 1 WHERE id = vehicle_id;
END;
$$ LANGUAGE plpgsql;

-- Agregar columna transmission si no existe
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS transmission TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
