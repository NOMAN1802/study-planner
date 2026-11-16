import { redirect } from "next/navigation";
import { cache } from "react";
import type { WeekStart } from "@/lib/dates";
import { ensureProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  timezone: string;
  weekStartsOn: WeekStart;
};

/**
 * The signed-in user's profile, or a redirect to /login.
 * Cached per request so layouts, pages and actions share one lookup.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || typeof claims.sub !== "string") {
    redirect("/login");
  }
  const profile = await ensureProfile({
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  });
  return {
    id: profile.id,
    email: profile.email,
    timezone: profile.timezone,
    weekStartsOn: clampWeekStart(profile.weekStartsOn),
  };
});

export function clampWeekStart(value: number): WeekStart {
  return (Number.isInteger(value) && value >= 0 && value <= 6 ? value : 1) as WeekStart;
}
