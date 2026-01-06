-- Create leave_types table for managing different leave types
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  shift_options JSONB DEFAULT '["full"]'::jsonb, -- Options: ["full"], ["am", "pm"], ["full", "am", "pm"]
  is_active BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT TRUE,
  days_per_year DECIMAL(5, 2) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create attendance_settings table for configuring work hours
CREATE TABLE IF NOT EXISTS attendance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID, -- For future multi-org support
  check_in_time TIME NOT NULL DEFAULT '08:00',
  check_out_time TIME NOT NULL DEFAULT '17:00',
  default_work_hours DECIMAL(3, 1) DEFAULT 8,
  grace_period_minutes INTEGER DEFAULT 15,
  allow_overnight_shift BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Modify leave_requests table to add shift and leave_type_id
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS shift VARCHAR(50) DEFAULT 'full' CHECK (shift IN ('full', 'am', 'pm'));
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type_id UUID REFERENCES leave_types(id) ON DELETE SET NULL;
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_type_check;
ALTER TABLE leave_requests ALTER COLUMN type DROP NOT NULL;

-- Create index for leave_types
CREATE INDEX IF NOT EXISTS idx_leave_types_is_active ON leave_types(is_active);
CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type_id ON leave_requests(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status_user ON leave_requests(status, user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date_range ON leave_requests(start_date, end_date);

-- Add unique constraint on room_bookings to prevent double-booking same time/room
ALTER TABLE room_bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;
ALTER TABLE room_bookings ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (room_id WITH =, tsrange(start_time, end_time, '[]') WITH &&);

-- Ensure room_bookings has required fields
ALTER TABLE room_bookings ALTER COLUMN title SET NOT NULL;
ALTER TABLE room_bookings ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE room_bookings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE room_bookings ALTER COLUMN start_time SET NOT NULL;
ALTER TABLE room_bookings ALTER COLUMN end_time SET NOT NULL;

-- Add constraint to prevent start_time after end_time in room_bookings
ALTER TABLE room_bookings ADD CONSTRAINT valid_booking_time_range
  CHECK (start_time < end_time);

-- Create index for room_bookings queries
CREATE INDEX IF NOT EXISTS idx_room_bookings_user_status ON room_bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_room_bookings_time_range ON room_bookings(start_time, end_time);

-- Add is_approved field to profiles if needed for staff approval
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_rejected BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create indexes for profile approval tracking
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_rejected ON profiles(approval_rejected);

-- Add leader_id to teams for team hierarchy
ALTER TABLE teams ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON teams(leader_id);

-- Insert default leave types if not exists
INSERT INTO leave_types (name, description, shift_options, days_per_year)
VALUES 
  ('Annual Leave', 'Paid annual vacation leave', '["full", "am", "pm"]'::jsonb, 12),
  ('Sick Leave', 'Medical or health-related leave', '["full", "am", "pm"]'::jsonb, 5),
  ('Personal Leave', 'Personal reasons leave', '["full", "am", "pm"]'::jsonb, 3),
  ('Unpaid Leave', 'Unpaid absence from work', '["full", "am", "pm"]'::jsonb, 0),
  ('Maternity Leave', 'Maternity leave', '["full"]'::jsonb, 90),
  ('Sabbatical', 'Long-term leave', '["full"]'::jsonb, 0)
ON CONFLICT (name) DO NOTHING;

-- Insert default attendance settings if not exists
INSERT INTO attendance_settings (check_in_time, check_out_time, default_work_hours, grace_period_minutes)
SELECT '08:00'::TIME, '17:00'::TIME, 8, 15
WHERE NOT EXISTS (SELECT 1 FROM attendance_settings LIMIT 1);

-- Enable RLS on new/modified tables
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_types (everyone can read, only admins can modify)
CREATE POLICY "Anyone can read leave types" ON leave_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage leave types" ON leave_types FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for attendance_settings (everyone can read, only admins can modify)
CREATE POLICY "Anyone can read attendance settings" ON attendance_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage attendance settings" ON attendance_settings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Update existing leave_requests policies for new shift field
DROP POLICY IF EXISTS "Users can view own leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Leaders can view team leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Users can create leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Users can cancel own requests" ON leave_requests;

CREATE POLICY "Users can view own leave requests" ON leave_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Leaders and admins can view team leave requests" ON leave_requests
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('leader', 'admin')
    )
  );

CREATE POLICY "Users can create leave requests" ON leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit own pending requests" ON leave_requests
  FOR UPDATE USING (
    auth.uid() = user_id AND status = 'pending'
  )
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Leaders and admins can approve requests" ON leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('leader', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('leader', 'admin')
    )
  );
