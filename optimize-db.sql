-- Migración: Optimizaciones de base de datos (índices, constraints, triggers)
-- Date: 2026-03-21
-- Ejecutar en Supabase SQL Editor

-- =====================================================
-- 1. ELIMINAR ÍNDICES REDUNDANTES
-- =====================================================

-- idx_messages_conversation_id: cubierto por la FK y reemplazado por índice compuesto más abajo
DROP INDEX IF EXISTS idx_messages_conversation_id;

-- idx_notifications_read: columna de baja cardinalidad sola; reemplazado por índices compuestos más abajo
DROP INDEX IF EXISTS idx_notifications_read;


-- =====================================================
-- 2. ÍNDICES FALTANTES CRÍTICOS
-- =====================================================

-- follows: búsqueda por seguidor y por seguido
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id  ON follows(follower_id);

-- notifications: path caliente del chat (marcar leídas por user + link)
CREATE INDEX IF NOT EXISTS idx_notifications_user_link
  ON notifications(user_id, link) WHERE read = false;

-- notifications: filtro por tipo y estado de lectura
CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON notifications(user_id, type, read);

-- favorites: conteo de cuántos usuarios marcaron un vehículo como favorito
CREATE INDEX IF NOT EXISTS idx_favorites_vehicle_id ON favorites(vehicle_id);

-- reports: detección de reportes duplicados del mismo usuario sobre el mismo vehículo
CREATE INDEX IF NOT EXISTS idx_reports_reporter_vehicle
  ON reports(reporter_id, vehicle_id);

-- conversations: orden cronológico descendente en la lista de chats
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON conversations(updated_at DESC);

-- vehicle_images: lookup de imagen principal de un vehículo
CREATE INDEX IF NOT EXISTS idx_vehicle_images_primary
  ON vehicle_images(vehicle_id, is_primary)
  WHERE is_primary = true;

-- vehicles: ordenar por popularidad solo entre activos
CREATE INDEX IF NOT EXISTS idx_vehicles_view_count
  ON vehicles(view_count DESC)
  WHERE status = 'active';


-- =====================================================
-- 3. CHECK CONSTRAINTS
-- =====================================================

-- vehicles.status
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_vehicles_status;
ALTER TABLE vehicles ADD CONSTRAINT chk_vehicles_status
  CHECK (status IN ('active', 'sold', 'inactive', 'paused', 'reserved'));

-- reports.status
ALTER TABLE reports DROP CONSTRAINT IF EXISTS chk_reports_status;
ALTER TABLE reports ADD CONSTRAINT chk_reports_status
  CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed'));

-- vehicles.year
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_vehicles_year;
ALTER TABLE vehicles ADD CONSTRAINT chk_vehicles_year
  CHECK (year >= 1900 AND year <= 2100);

-- vehicles.price
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_vehicles_price;
ALTER TABLE vehicles ADD CONSTRAINT chk_vehicles_price
  CHECK (price > 0);

-- vehicles.mileage
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_vehicles_mileage;
ALTER TABLE vehicles ADD CONSTRAINT chk_vehicles_mileage
  CHECK (mileage >= 0);


-- =====================================================
-- 4. NOT NULL EN profiles
-- =====================================================

-- Limpiar NULLs antes de aplicar la restricción
UPDATE profiles SET is_admin    = false WHERE is_admin    IS NULL;
UPDATE profiles SET is_banned   = false WHERE is_banned   IS NULL;
UPDATE profiles SET is_verified = false WHERE is_verified IS NULL;

ALTER TABLE profiles ALTER COLUMN is_admin    SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN is_banned   SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN is_verified SET NOT NULL;


-- =====================================================
-- 5. TRIGGER PARA conversations.updated_at
-- =====================================================

-- La función update_updated_at() ya existe (definida en supabase-migration.sql).
-- Se replica el mismo patrón usado en profiles y vehicles.

CREATE OR REPLACE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
