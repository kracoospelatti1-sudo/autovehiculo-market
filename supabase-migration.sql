-- =====================================================
-- AUTO VEHÍCULO MARKET - SQL DE MIGRACIÓN
-- Ejecuta este código en el SQL Editor de Supabase
-- =====================================================

-- Tabla de usuarios (Auth manual simplificada)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de perfiles (extensión de users)
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

-- Tabla de vehículos
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price REAL NOT NULL,
  mileage INTEGER DEFAULT 0,
  fuel TEXT DEFAULT '',
  description TEXT DEFAULT '',
  city TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de imágenes de vehículos
CREATE TABLE IF NOT EXISTS vehicle_images (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de vistas de vehículos (para estadísticas)
CREATE TABLE IF NOT EXISTS vehicle_views (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  viewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  viewer_ip TEXT,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vehicle_id, buyer_id)
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de favoritos
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, vehicle_id)
);

-- Tabla de notificaciones
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

-- Tabla de calificaciones/ratings
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

-- Tabla de reportes
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para incrementar vistas
CREATE OR REPLACE FUNCTION increment_view_count(vehicle_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE vehicles SET view_count = view_count + 1 WHERE id = vehicle_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand ON vehicles(brand);
CREATE INDEX IF NOT EXISTS idx_vehicles_price ON vehicles(price);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_ratings_to_user_id ON ratings(to_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
CREATE POLICY "Profiles son públicos para lectura" ON profiles FOR SELECT USING (true);
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON profiles FOR UPDATE USING (user_id = current_user_id());

-- Policies para vehicles
CREATE POLICY "Vehículos activos son públicos" ON vehicles FOR SELECT USING (status = 'active' OR user_id = current_user_id());
CREATE POLICY "Usuarios pueden crear vehículos" ON vehicles FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY "Usuarios pueden actualizar sus vehículos" ON vehicles FOR UPDATE USING (user_id = current_user_id());
CREATE POLICY "Usuarios pueden eliminar sus vehículos" ON vehicles FOR DELETE USING (user_id = current_user_id());

-- Policies para vehicle_images
CREATE POLICY "Imágenes de vehículos son públicas" ON vehicle_images FOR SELECT USING (true);
CREATE POLICY "Propietarios pueden agregar imágenes" ON vehicle_images FOR INSERT WITH CHECK (
  vehicle_id IN (SELECT id FROM vehicles WHERE user_id = current_user_id())
);

-- Policies para conversations
CREATE POLICY "Usuarios ven sus conversaciones" ON conversations FOR SELECT 
  USING (buyer_id = current_user_id() OR seller_id = current_user_id());

-- Policies para messages
CREATE POLICY "Usuarios ven mensajes de sus conversaciones" ON messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE buyer_id = current_user_id() OR seller_id = current_user_id()
  ));

-- Policies para favorites
CREATE POLICY "Favoritos son privados" ON favorites FOR SELECT USING (user_id = current_user_id());

-- Policies para notifications
CREATE POLICY "Usuarios ven sus notificaciones" ON notifications FOR SELECT USING (user_id = current_user_id());
CREATE POLICY "Usuarios pueden actualizar notificaciones" ON notifications FOR UPDATE USING (user_id = current_user_id());

-- Policies para ratings
CREATE POLICY "Ratings son públicos" ON ratings FOR SELECT USING (true);

-- Policies para reports
CREATE POLICY "Reportes visibles para admins" ON reports FOR SELECT USING (
  true
);

PRINT '========================================';
PRINT 'Migración completada exitosamente!';
PRINT '========================================';
