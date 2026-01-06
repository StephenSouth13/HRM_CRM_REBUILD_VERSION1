-- Create projects table for teams
CREATE TABLE public.projects (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS policies for projects
CREATE POLICY "Anyone can view active projects" ON public.projects FOR SELECT USING (is_active = true);
CREATE POLICY "Team members can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team members can update projects" ON public.projects FOR UPDATE USING (
    auth.uid() = created_by OR 
    has_role(auth.uid(), 'leader'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add project_id to task_columns
ALTER TABLE public.task_columns ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- Update tasks to reference project via column
ALTER TABLE public.tasks DROP COLUMN IF EXISTS column_id;
ALTER TABLE public.tasks ADD COLUMN column_id uuid REFERENCES public.task_columns(id) ON DELETE SET NULL;

-- Create weekly schedule table for shifts
CREATE TABLE public.user_shift_schedules (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE NOT NULL,
    day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, day_of_week)
);

ALTER TABLE public.user_shift_schedules ENABLE ROW LEVEL SECURITY;

-- RLS for shift schedules
CREATE POLICY "Admins can manage shift schedules" ON public.user_shift_schedules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Leaders can view team schedules" ON public.user_shift_schedules FOR SELECT USING (
    has_role(auth.uid(), 'leader'::app_role) AND EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = user_shift_schedules.user_id 
        AND profiles.team_id = get_user_team(auth.uid())
    )
);
CREATE POLICY "Users can view their own schedule" ON public.user_shift_schedules FOR SELECT USING (auth.uid() = user_id);

-- Create attendance validation log table
CREATE TABLE public.attendance_validations (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    attendance_id uuid REFERENCES public.attendance(id) ON DELETE CASCADE NOT NULL,
    expected_shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
    is_on_time boolean NOT NULL DEFAULT false,
    minutes_early integer DEFAULT 0,
    minutes_late integer DEFAULT 0,
    validation_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage validations" ON public.attendance_validations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their validations" ON public.attendance_validations FOR SELECT USING (
    EXISTS (SELECT 1 FROM attendance WHERE attendance.id = attendance_validations.attendance_id AND attendance.user_id = auth.uid())
);

-- Function to validate attendance check-in
CREATE OR REPLACE FUNCTION public.validate_attendance_checkin()
RETURNS TRIGGER AS $$
DECLARE
    user_shift RECORD;
    shift_info RECORD;
    current_day integer;
    time_diff interval;
BEGIN
    -- Only validate check_in type
    IF NEW.type != 'check_in' THEN
        RETURN NEW;
    END IF;
    
    -- Get current day of week (0 = Sunday)
    current_day := EXTRACT(DOW FROM NEW.timestamp);
    
    -- Get user's shift for today
    SELECT uss.shift_id, s.start_time, s.end_time, s.name 
    INTO user_shift 
    FROM public.user_shift_schedules uss
    JOIN public.shifts s ON s.id = uss.shift_id
    WHERE uss.user_id = NEW.user_id AND uss.day_of_week = current_day;
    
    -- If no schedule found, check default shift
    IF user_shift IS NULL THEN
        SELECT s.id as shift_id, s.start_time, s.end_time, s.name
        INTO user_shift
        FROM public.profiles p
        JOIN public.shifts s ON s.id = p.shift_id
        WHERE p.id = NEW.user_id;
    END IF;
    
    -- If still no shift, skip validation
    IF user_shift IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Calculate time difference
    time_diff := (NEW.timestamp::time - user_shift.start_time);
    
    -- Insert validation record
    INSERT INTO public.attendance_validations (
        attendance_id, 
        expected_shift_id, 
        is_on_time,
        minutes_early,
        minutes_late,
        validation_message
    ) VALUES (
        NEW.id,
        user_shift.shift_id,
        EXTRACT(EPOCH FROM time_diff) BETWEEN -900 AND 300, -- 15 min early to 5 min late
        CASE WHEN time_diff < interval '0' THEN ABS(EXTRACT(EPOCH FROM time_diff) / 60)::integer ELSE 0 END,
        CASE WHEN time_diff > interval '0' THEN (EXTRACT(EPOCH FROM time_diff) / 60)::integer ELSE 0 END,
        CASE 
            WHEN time_diff < interval '-15 minutes' THEN 'Đến quá sớm'
            WHEN time_diff <= interval '5 minutes' THEN 'Đúng giờ'
            WHEN time_diff <= interval '30 minutes' THEN 'Đi trễ'
            ELSE 'Đi trễ nhiều'
        END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for attendance validation
CREATE TRIGGER validate_attendance_on_insert
    AFTER INSERT ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_attendance_checkin();

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_shift_schedules_updated_at
    BEFORE UPDATE ON public.user_shift_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();