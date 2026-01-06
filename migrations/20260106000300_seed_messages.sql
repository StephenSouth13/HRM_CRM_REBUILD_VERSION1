-- Seed data for messaging feature (small dataset for testing)
-- Insert two users (assumes profiles exist) and a direct conversation + messages

-- Replace these IDs with real profile IDs from your environment
\echo 'Remember to replace placeholder IDs before running this seed file'

-- Example placeholders:
-- 
-- DO NOT RUN as-is unless you replace ids below

INSERT INTO conversations (id, name, is_group, created_by, created_at)
VALUES
  ('conv-seed-1', NULL, false, 'user-1-id', now()),
  ('conv-seed-2', 'Team Alpha', true, 'leader-1-id', now());

INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at, muted)
VALUES
  ('conv-seed-1', 'user-1-id', 'member', now(), false),
  ('conv-seed-1', 'user-2-id', 'member', now(), false),
  ('conv-seed-2', 'leader-1-id', 'leader', now(), false),
  ('conv-seed-2', 'user-1-id', 'member', now(), false),
  ('conv-seed-2', 'user-2-id', 'member', now(), false);

INSERT INTO messages (id, conversation_id, sender_id, content, created_at, edited, deleted)
VALUES
  ('msg-1', 'conv-seed-1', 'user-1-id', 'Hello! This is a seeded DM.', now(), false, false),
  ('msg-2', 'conv-seed-1', 'user-2-id', 'Hi — received your message.', now(), false, false),
  ('msg-3', 'conv-seed-2', 'leader-1-id', 'Welcome to Team Alpha chat.', now(), false, false);

-- sample reaction
INSERT INTO message_reactions (message_id, user_id, emoji, reacted_at)
VALUES ('msg-3', 'user-1-id', '👍', now());
