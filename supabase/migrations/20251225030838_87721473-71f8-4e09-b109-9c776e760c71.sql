-- Create salaries table with proper foreign key to profiles
CREATE TABLE public.salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month DATE NOT NULL,
  base_salary NUMERIC(15, 2) NOT NULL DEFAULT 0,
  bonus NUMERIC(15, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(15, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(15, 2) GENERATED ALWAYS AS (base_salary + bonus - deductions) STORED,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month),
  CONSTRAINT salaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all salaries"
ON public.salaries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leaders can view team salaries"
ON public.salaries
FOR SELECT
USING (
  has_role(auth.uid(), 'leader'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = salaries.user_id 
    AND profiles.team_id = get_user_team(auth.uid())
  )
);

CREATE POLICY "Users can view their own salaries"
ON public.salaries
FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_salaries_updated_at
BEFORE UPDATE ON public.salaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();