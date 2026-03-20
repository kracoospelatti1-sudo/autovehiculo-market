-- Chat improvements migration
-- Run this in Supabase SQL Editor

-- Add read_at column for read receipts
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

-- Index for delta polling (fetching messages newer than a given ID)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at ASC);

-- Index for marking unread messages as read
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages(conversation_id, sender_id, read_at)
  WHERE read_at IS NULL;
