import { type NextRequest } from "next/server";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";

const AUTH_PATHS = new Set(["/login", "/signup"]);

export async function proxy(request: NextRequest) {
  const { response, user, signedOut } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PATHS.has(pathname);

  // Only a real sign-out goes to /login. When the check merely failed (a slow
  // phone network, a timeout) the cookies are still good: let the page's own
  // check retry instead of throwing the user out.
  if (signedOut && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return redirectWithSession(url, response);
  }

  if (user && (isAuthPage || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithSession(url, response);
  }

  return response;
}

export const config = {
  matcher: [
    {
      // Everything except Next internals and static assets.
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
      // Not link prefetches: opening the phone menu prefetches every link at
      // once, and each would refresh the session in parallel and could cache a
      // redirect to /login for that link. Pages still check the user themselves.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
