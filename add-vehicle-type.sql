-- Soporte de motos — AutoVehículo Market
-- Agregar tipo de vehículo (default 'auto' para no romper datos existentes)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT NOT NULL DEFAULT 'auto'
    CHECK (vehicle_type IN ('auto', 'moto'));

-- Agregar cilindrada (solo aplica a motos, NULL para autos)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS engine_cc INTEGER;

-- Índice para filtrar por tipo
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
