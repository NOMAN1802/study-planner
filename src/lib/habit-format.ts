import type { Frequency } from "@/lib/dates";

const FREQ_LABEL: Record<Frequency, string> = {
  HOURLY: "Hourly",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

/** e.g. "Daily · 2× · 30 min". Safe to use from server and client components. */
export function targetSummary(h: {
  frequency: Frequency;
  targetCount: number | null;
  targetMinutes: number | null;
}): string {
  const parts: string[] = [FREQ_LABEL[h.frequency]];
  if (h.targetCount) parts.push(`${h.targetCount}×`);
  if (h.targetMinutes) parts.push(`${h.targetMinutes} min`);
  return parts.join(" · ");
}
