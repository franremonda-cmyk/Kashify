-- Migration: Neo notifications table for proactive in-app messages

CREATE TABLE IF NOT EXISTS neo_notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message    text        NOT NULL,
  type       text        NOT NULL DEFAULT 'alert',
  read_at    timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE neo_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "neo_notifications_own"
  ON neo_notifications FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS neo_notifications_user_created
  ON neo_notifications (user_id, created_at DESC);
