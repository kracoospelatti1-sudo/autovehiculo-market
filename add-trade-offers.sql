-- Migration: Create trade_offers table
-- Date: 2026-03-21
-- Ejecutar con: npx supabase db execute --file add-trade-offers.sql

CREATE TABLE IF NOT EXISTS trade_offers (
  id                 SERIAL PRIMARY KEY,
  vehicle_id         INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  offered_vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  proposer_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
  owner_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message            TEXT DEFAULT '',
  status             TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trade_offers_owner_id    ON trade_offers(owner_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_proposer_id ON trade_offers(proposer_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_vehicle_id  ON trade_offers(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status      ON trade_offers(status) WHERE status = 'pending';
