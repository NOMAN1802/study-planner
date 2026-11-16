import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";

export type SessionUser = {
  id: string;
  email: string | null;
};

/**
 * Refreshes the Supabase session on every matched request and forwards any
 * rotated auth cookies to both the downstream request and the response.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims verifies the JWT signature locally; no network round-trip per request.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const user: SessionUser | null =
    claims && typeof claims.sub === "string"
      ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null }
      : null;

  return { response, user };
}
