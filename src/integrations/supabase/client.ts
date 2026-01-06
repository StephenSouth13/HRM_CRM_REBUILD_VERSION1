import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://arpfgeyugjvubpbcfzgn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycGZnZXl1Z2p2dWJwYmNmemduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTEzNjQsImV4cCI6MjA4MzIyNzM2NH0.JMe5Dt3NWOluuFSiLaz_YOzocwDHBnkjLd55t8OFY9A";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Note: Service role (server-only) key is sensitive and should NOT be used in client-side code.
// If you need to run server-side scripts, set SUPABASE_SERVICE_ROLE in your server environment.
