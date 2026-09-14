import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client Configuration
 *
 * Environment variables required:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_KEY: Service role key (NOT anon key - needs admin access)
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase credentials not configured. Authentication will be disabled.');
  console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export default supabase;
