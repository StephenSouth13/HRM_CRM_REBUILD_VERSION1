-- Add new fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS school text,
ADD COLUMN IF NOT EXISTS major text;

-- Delete any sample/mockup data from meeting_rooms and room_bookings
DELETE FROM public.room_bookings WHERE title LIKE '%test%' OR title LIKE '%sample%' OR title LIKE '%mock%' OR title LIKE '%Test%';

-- Comment: cv_url column already exists based on types.ts