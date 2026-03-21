-- Migration: historial de precios por vehículo
-- Date: 2026-03-21

CREATE TABLE IF NOT EXISTS vehicle_price_history (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_history_vehicle_id
  ON vehicle_price_history(vehicle_id, created_at DESC);
