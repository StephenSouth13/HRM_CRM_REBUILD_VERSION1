-- Fix notify_leave_request to handle null names
CREATE OR REPLACE FUNCTION public.notify_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_user_name text;
BEGIN
  -- Get requester name with defaults for NULL values
  SELECT COALESCE(first_name, 'User') || ' ' || COALESCE(last_name, '') INTO v_user_name
  FROM profiles WHERE id = NEW.user_id;
  
  v_user_name := TRIM(COALESCE(v_user_name, 'User'));
  
  -- Notify all admins
  FOR v_admin_id IN 
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    PERFORM create_notification(
      v_admin_id,
      'leave_request',
      'New Leave Request',
      v_user_name || ' has requested leave from ' || NEW.start_date || ' to ' || NEW.end_date,
      '/leave'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Fix notify_task_assignment to handle null names
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_name text;
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
    -- Get creator name with defaults for NULL values
    SELECT COALESCE(first_name, 'User') || ' ' || COALESCE(last_name, '') INTO v_creator_name
    FROM profiles WHERE id = NEW.creator_id;
    
    v_creator_name := TRIM(COALESCE(v_creator_name, 'User'));
    
    -- Notify assignee
    PERFORM create_notification(
      NEW.assignee_id,
      'task_assigned',
      'New Task Assigned',
      v_creator_name || ' assigned you a task: ' || NEW.title,
      '/tasks'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix notify_room_booking to handle null names
CREATE OR REPLACE FUNCTION public.notify_room_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_user_name text;
BEGIN
  -- Get requester name with defaults for NULL values
  SELECT COALESCE(first_name, 'User') || ' ' || COALESCE(last_name, '') INTO v_user_name
  FROM profiles WHERE id = NEW.user_id;
  
  v_user_name := TRIM(COALESCE(v_user_name, 'User'));
  
  -- Notify all admins and leaders
  FOR v_admin_id IN 
    SELECT user_id FROM user_roles WHERE role IN ('admin', 'leader')
  LOOP
    PERFORM create_notification(
      v_admin_id,
      'room_booking',
      'New Room Booking Request',
      v_user_name || ' has requested to book a room: ' || NEW.title,
      '/meeting-rooms'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;
