import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://tyverlryifverobjwauo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dmVybHJ5aWZ2ZXJvYmp3YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTg1NDcsImV4cCI6MjA4MDMzNDU0N30.TMjvoWYRyCGvzu0NS7KIv1BojwXaZAt1mPIOBmKQwCo";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
