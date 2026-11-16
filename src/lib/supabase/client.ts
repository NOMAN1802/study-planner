"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/env";

/** Supabase client for Client Components. */
export function createClient() {
  return createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey);
}
