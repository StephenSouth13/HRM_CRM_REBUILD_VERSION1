-- Migration: add attachments table and mute notifications flag
BEGIN;

-- attachments table stores metadata; actual files will be stored in Supabase Storage (bucket: message-attachments)
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,
  url text NOT NULL,
  mime_type text NOT NULL,
  size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_uploaded_by ON message_attachments(uploaded_by);

-- add attachment_id to messages
ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS attachment_id uuid REFERENCES message_attachments(id) ON DELETE SET NULL;

-- add muted flag to conversation_participants for per-conversation notifications
ALTER TABLE IF EXISTS conversation_participants
  ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false;

COMMIT;

-- Note: create a Supabase Storage bucket named 'message-attachments' and configure appropriate public/private policies.
