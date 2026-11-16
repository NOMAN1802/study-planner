import { prisma } from "@/lib/prisma";
import { normalizeTimezone } from "@/lib/timezone";

export type EnsureProfileInput = {
  id: string;
  email: string | null;
  timezone?: string | null;
};

/**
 * Returns the Profile for a Supabase user, creating it on first sign-in.
 * The timezone is only applied when the row is created; the user can change
 * it later in Settings.
 */
export async function ensureProfile(input: EnsureProfileInput) {
  const existing = await prisma.profile.findUnique({ where: { id: input.id } });
  if (existing) {
    return existing;
  }
  return prisma.profile.create({
    data: {
      id: input.id,
      email: input.email ?? "",
      timezone: normalizeTimezone(input.timezone),
    },
  });
}
