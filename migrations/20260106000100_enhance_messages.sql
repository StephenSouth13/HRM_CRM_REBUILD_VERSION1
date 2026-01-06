-- Migration: enhance messages schema for groups, edits, deletes and reactions
BEGIN;

-- conversations: add created_by and is_group
ALTER TABLE IF EXISTS conversations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

-- participants: add role (member/leader/admin) and unique constraint
ALTER TABLE IF EXISTS conversation_participants
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';

ALTER TABLE IF EXISTS conversation_participants
  ADD CONSTRAINT IF NOT EXISTS uq_conversation_user UNIQUE (conversation_id, user_id);

-- messages: add edited/deleted metadata
ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);

COMMIT;
