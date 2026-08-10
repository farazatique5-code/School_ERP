// core/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env.local before running the app.',
  );
}

// Deliberately NOT parameterized with <Database>. Passing a strict schema
// type here makes Supabase's compile-time query parser try to verify every
// joined `.select('*, foo(...)')` against a real Relationships (foreign
// key) array — which our generated-types stand-in doesn't have populated
// with real data, so it rejected every join as an unverifiable relationship
// (SelectQueryError). Untyped mode skips that verification entirely.
// Once you regenerate database.types.ts for real via the Supabase CLI
// (which DOES populate real Relationships data), re-add <Database> here.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
