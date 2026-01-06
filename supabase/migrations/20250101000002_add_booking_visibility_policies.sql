-- Drop old policies to replace with more comprehensive ones
DROP POLICY IF EXISTS "Users can view their own bookings" ON room_bookings;
DROP POLICY IF EXISTS "Leaders can view team bookings" ON room_bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON room_bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON room_bookings;

-- Select policies: Allow viewing approved bookings + own bookings + admin/leader access
CREATE POLICY "Staff can view approved bookings and own bookings" ON room_bookings
FOR SELECT
USING (
  status = 'approved' OR
  auth.uid() = user_id OR
  public.has_role(auth.uid(), 'leader') OR
  public.has_role(auth.uid(), 'admin')
);

-- Insert policies: Users can only create pending bookings
CREATE POLICY "Users can create pending bookings" ON room_bookings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  status = 'pending'
);

-- Update policies: Users can update own pending, Leaders/Admins can update any
DROP POLICY IF EXISTS "Users can update their own bookings" ON room_bookings;
DROP POLICY IF EXISTS "Leaders and admins can update bookings" ON room_bookings;

CREATE POLICY "Users can update own pending bookings" ON room_bookings
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Leaders and admins can update all bookings" ON room_bookings
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'leader') OR
  public.has_role(auth.uid(), 'admin')
);
