-- Optimización de índices — AutoVehículo Market
-- Fase 4 del plan de performance

-- Índice compuesto para búsqueda de vehículos con filtros de ubicación y estado
CREATE INDEX IF NOT EXISTS idx_vehicles_status_province_city
  ON vehicles(status, province, city);

-- Índice parcial para vehículos activos ordenados por fecha (listado principal)
CREATE INDEX IF NOT EXISTS idx_vehicles_active_created
  ON vehicles(created_at DESC)
  WHERE status = 'active';

-- OMITIDO: idx_messages_conv_sender_read
-- Duplicado de idx_messages_unread (add-messages-index.sql):
--   ON messages(conversation_id, sender_id) WHERE read_at IS NULL

-- OMITIDO: idx_conversations_buyer_id
-- Ya existe en supabase-migration.sql

-- OMITIDO: idx_conversations_seller_id
-- Ya existe en supabase-migration.sql

-- OMITIDO: idx_vehicles_created_at
-- Ya existe en supabase-migration.sql (línea 163)

-- Índice para notificaciones no leídas por usuario
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id)
  WHERE read = false;
