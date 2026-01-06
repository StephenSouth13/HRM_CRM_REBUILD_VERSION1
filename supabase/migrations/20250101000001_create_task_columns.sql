-- Create task_boards table (for grouping columns by project/board)
CREATE TABLE IF NOT EXISTS task_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL DEFAULT 'Default Board',
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create task_columns table to store custom columns
CREATE TABLE IF NOT EXISTS task_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint on board_id + name to prevent duplicate column names
ALTER TABLE task_columns ADD CONSTRAINT unique_board_column_name UNIQUE (board_id, name);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_columns_board_id ON task_columns(board_id);
CREATE INDEX IF NOT EXISTS idx_task_columns_position ON task_columns(position);
CREATE INDEX IF NOT EXISTS idx_task_boards_is_active ON task_boards(is_active);

-- Insert default board
INSERT INTO task_boards (name, description, is_active)
VALUES ('Default Board', 'Default task board', TRUE)
ON CONFLICT DO NOTHING;

-- Insert default columns for the default board
INSERT INTO task_columns (board_id, name, position, is_default)
SELECT id, 'To Do', 0, TRUE FROM task_boards WHERE name = 'Default Board' AND NOT EXISTS (SELECT 1 FROM task_columns WHERE board_id = task_boards.id AND name = 'To Do')
UNION ALL
SELECT id, 'In Progress', 1, TRUE FROM task_boards WHERE name = 'Default Board' AND NOT EXISTS (SELECT 1 FROM task_columns WHERE board_id = task_boards.id AND name = 'In Progress')
UNION ALL
SELECT id, 'Review', 2, TRUE FROM task_boards WHERE name = 'Default Board' AND NOT EXISTS (SELECT 1 FROM task_columns WHERE board_id = task_boards.id AND name = 'Review')
UNION ALL
SELECT id, 'Done', 3, TRUE FROM task_boards WHERE name = 'Default Board' AND NOT EXISTS (SELECT 1 FROM task_columns WHERE board_id = task_boards.id AND name = 'Done')
ON CONFLICT DO NOTHING;

-- Update tasks table to use text status instead of enum for flexibility
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ALTER COLUMN status TYPE VARCHAR(100);

-- Enable RLS on new tables
ALTER TABLE task_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_columns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_boards
CREATE POLICY "Anyone can read task boards" ON task_boards FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Users can create their own boards" ON task_boards FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Board creators can update their boards" ON task_boards FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for task_columns
CREATE POLICY "Anyone can read task columns" ON task_columns FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM task_boards WHERE id = board_id AND is_active = TRUE
  )
);
CREATE POLICY "Board creators can manage columns" ON task_columns FOR ALL USING (
  EXISTS (
    SELECT 1 FROM task_boards 
    WHERE id = board_id AND (created_by = auth.uid() OR is_active = TRUE)
  )
);
