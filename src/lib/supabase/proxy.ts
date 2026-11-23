import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readClaims } from "@/lib/supabase/claims";
import { supabaseEnv } from "@/lib/env";

export type SessionUser = {
  id: string;
  email: string | null;
};

export type SessionState = {
  /** Carries any rotated auth cookies; copy them onto a redirect too. */
  response: NextResponse;
  user: SessionUser | null;
  /**
   * True only when there is no session at all: no auth cookie, or Supabase
   * rejected it and the cookies were cleared. A failed check while the
   * cookies are still there (slow mobile network, timeout) is not a sign-out.
   */
  signedOut: boolean;
};

const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Refreshes the Supabase session on every matched request and forwards any
 * rotated auth cookies to both the downstream request and the response.
 */
export async function updateSession(request: NextRequest): Promise<SessionState> {
  let response = NextResponse.next({ request });
  let cleared = false;

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          if (AUTH_COOKIE.test(name) && !value) cleared = true;
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const hadSession = request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name) && c.value);
  const { claims, error } = await readClaims(supabase);
  const user: SessionUser | null =
    claims && typeof claims.sub === "string"
      ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null }
      : null;

  const signedOut = !user && (!hadSession || cleared);
  if (!user && hadSession) {
    // Names only, never cookie values: enough to tell a lost session from a blip.
    console.warn("[auth] session check failed", {
      path: request.nextUrl.pathname,
      cleared,
      error: error ? `${error.name}: ${error.message}` : null,
    });
  }

  return { response, user, signedOut };
}

/** A redirect that keeps the auth cookies the session refresh just set. */
export function redirectWithSession(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
