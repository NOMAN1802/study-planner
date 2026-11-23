import type { SupabaseClient } from "@supabase/supabase-js";

type Claims = { sub?: unknown; email?: unknown; [key: string]: unknown };

export type ClaimsResult = { claims: Claims | null; error: Error | null };

const RETRY_DELAY_MS = 300;

/**
 * True for failures that say nothing about the session itself: the network
 * dropped, Supabase timed out or returned a 5xx. These are worth one retry and
 * must never be treated as a sign-out.
 */
export function isTransientAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, status } = error as { name?: unknown; status?: unknown };
  if (name === "AuthRetryableFetchError") return true;
  if (typeof status === "number") return status === 0 || status >= 500;
  return name === "TypeError" || name === "AbortError";
}

/**
 * The signed-in user's verified JWT claims, refreshing the session when it
 * has expired. Retries once on a transient failure, so a single slow request
 * on a phone does not look like being signed out.
 */
export async function readClaims(supabase: SupabaseClient): Promise<ClaimsResult> {
  let last: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabase.auth.getClaims();
      if (data?.claims) return { claims: data.claims as Claims, error: null };
      last = error ?? null;
      if (!isTransientAuthError(error)) break;
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (!isTransientAuthError(e)) break;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  return { claims: null, error: last };
}
