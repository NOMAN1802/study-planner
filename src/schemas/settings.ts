import { z } from "zod";
import { normalizeTimezone } from "@/lib/timezone";

export const settingsSchema = z.object({
  timezone: z
    .string({ error: "Pick a timezone" })
    .trim()
    .min(1, "Pick a timezone")
    .refine((tz) => normalizeTimezone(tz) === tz, "Unknown timezone"),
  weekStartsOn: z.coerce
    .number({ error: "Pick a week start" })
    .int()
    .min(0, "Pick a week start")
    .max(6, "Pick a week start"),
});

export type SettingsFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"timezone" | "weekStartsOn", string>>;
  ok?: boolean;
};
