-- Create enum for team roles
CREATE TYPE public.team_role AS ENUM ('developer', 'designer', 'tester', 'leader', 'member');

-- Add team_role column to profiles
ALTER TABLE public.profiles ADD COLUMN team_role public.team_role DEFAULT 'member';