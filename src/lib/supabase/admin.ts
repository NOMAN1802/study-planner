import { createClient } from "@supabase/supabase-js";
import { supabaseEnv, supabaseServiceRoleKey } from "@/lib/env";

/**
 * Supabase client with the service-role key, for server code only (it
 * bypasses row-level security). Null when the key is not configured.
 */
export function createAdminClient() {
  const key = supabaseServiceRoleKey();
  if (!key) return null;
  return createClient(supabaseEnv.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
