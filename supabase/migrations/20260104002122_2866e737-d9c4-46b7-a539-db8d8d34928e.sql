-- Add new columns for detailed salary calculation
ALTER TABLE public.salaries
ADD COLUMN IF NOT EXISTS working_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS shift_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS kpi_bonus numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_bonus numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekend_bonus numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_bonus numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_penalty numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS absence_penalty numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS violation_penalty numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS absence_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS violation_notes text;

-- Create salary settings table for company-wide settings
CREATE TABLE IF NOT EXISTS public.salary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_shift_rate numeric NOT NULL DEFAULT 200000,
  default_overtime_rate numeric NOT NULL DEFAULT 30000,
  late_penalty_per_time numeric NOT NULL DEFAULT 50000,
  absence_penalty_per_day numeric NOT NULL DEFAULT 200000,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

-- Policies for salary_settings
CREATE POLICY "Admins can manage salary settings"
ON public.salary_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view salary settings"
ON public.salary_settings
FOR SELECT
USING (true);

-- Insert default settings
INSERT INTO public.salary_settings (default_shift_rate, default_overtime_rate, late_penalty_per_time, absence_penalty_per_day)
VALUES (200000, 30000, 50000, 200000)
ON CONFLICT DO NOTHING;