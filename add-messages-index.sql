-- Migration: Índice en messages para queries de chat
-- Date: 2026-03-21
-- Ejecutar en Supabase SQL Editor

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages(conversation_id, sender_id, read_at)
  WHERE read_at IS NULL;
