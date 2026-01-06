-- Create salaries table for salary management
CREATE TABLE IF NOT EXISTS public.salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  base_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  bonus DECIMAL(15,2) DEFAULT 0,
  deductions DECIMAL(15,2) DEFAULT 0,
  net_salary DECIMAL(15,2) GENERATED ALWAYS AS (base_salary + COALESCE(bonus, 0) - COALESCE(deductions, 0)) STORED,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Create attendance_settings table
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_in_time TIME NOT NULL DEFAULT '08:00:00',
  check_out_time TIME NOT NULL DEFAULT '17:00:00',
  default_work_hours INTEGER NOT NULL DEFAULT 8,
  grace_period_minutes INTEGER NOT NULL DEFAULT 15,
  allow_overnight_shift BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on salaries
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

-- Enable RLS on attendance_settings
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for salaries
CREATE POLICY "Admins can manage all salaries"
  ON public.salaries
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own salary"
  ON public.salaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for attendance_settings  
CREATE POLICY "Admins can manage attendance settings"
  ON public.attendance_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view attendance settings"
  ON public.attendance_settings
  FOR SELECT
  USING (true);

-- Add updated_at trigger for salaries
CREATE TRIGGER update_salaries_updated_at
  BEFORE UPDATE ON public.salaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for attendance_settings
CREATE TRIGGER update_attendance_settings_updated_at
  BEFORE UPDATE ON public.attendance_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default attendance settings
INSERT INTO public.attendance_settings (check_in_time, check_out_time, default_work_hours, grace_period_minutes, allow_overnight_shift)
VALUES ('08:00:00', '17:00:00', 8, 15, false)
ON CONFLICT DO NOTHING;