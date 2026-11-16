import { z } from "zod";
import { HABIT_COLOR_VALUES, HABIT_ICON_NAMES } from "@/lib/habit-options";

/** "" / null / undefined → null; otherwise a whole number in range. */
const optionalInt = (label: string, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z
      .number({ error: `${label} must be a number` })
      .int(`${label} must be a whole number`)
      .min(1, `${label} must be at least 1`)
      .max(max, `${label} must be at most ${max}`)
      .nullable(),
  );

const PERIOD_UNIT = { HOURLY: "hour", DAILY: "day", WEEKLY: "week", MONTHLY: "month" } as const;

export const habitSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .trim()
      .min(1, "Name is required")
      .max(60, "Name must be at most 60 characters"),
    note: z
      .string()
      .trim()
      .max(500, "Note must be at most 500 characters")
      .nullish()
      .transform((v) => (v ? v : null)),
    color: z.enum(HABIT_COLOR_VALUES, { error: "Pick a colour" }),
    icon: z.enum(HABIT_ICON_NAMES, { error: "Pick an icon" }),
    frequency: z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"], { error: "Pick a frequency" }),
    targetCount: optionalInt("Target count", 999),
    targetMinutes: optionalInt("Target minutes", 44_640),
    activeHours: z
      .array(z.coerce.number().int().min(0).max(23))
      .default([])
      .transform((hours) => [...new Set(hours)].sort((a, b) => a - b)),
  })
  .superRefine((value, ctx) => {
    const maxMinutes: Record<typeof value.frequency, number> = {
      HOURLY: 60,
      DAILY: 1440,
      WEEKLY: 10_080,
      MONTHLY: 44_640,
    };
    if (value.targetMinutes != null && value.targetMinutes > maxMinutes[value.frequency]) {
      ctx.addIssue({
        code: "custom",
        path: ["targetMinutes"],
        message: `Target minutes can't exceed ${maxMinutes[value.frequency]} per ${PERIOD_UNIT[value.frequency]}`,
      });
    }
  })
  // Active hours only apply to hourly habits.
  .transform((value) => ({
    ...value,
    activeHours: value.frequency === "HOURLY" ? value.activeHours : [],
  }));

export type HabitInput = z.output<typeof habitSchema>;
export type HabitField =
  | "name"
  | "note"
  | "color"
  | "icon"
  | "frequency"
  | "targetCount"
  | "targetMinutes"
  | "activeHours";
export type HabitFieldErrors = Partial<Record<HabitField, string>>;

export type HabitFormState = {
  error?: string;
  fieldErrors?: HabitFieldErrors;
};

export function habitFormValues(formData: FormData) {
  return {
    name: formData.get("name"),
    note: formData.get("note"),
    color: formData.get("color"),
    icon: formData.get("icon"),
    frequency: formData.get("frequency"),
    targetCount: formData.get("targetCount"),
    targetMinutes: formData.get("targetMinutes"),
    activeHours: formData.getAll("activeHours"),
  };
}

const HABIT_FIELDS = new Set<string>([
  "name",
  "note",
  "color",
  "icon",
  "frequency",
  "targetCount",
  "targetMinutes",
  "activeHours",
]);

export function habitFieldErrors(error: z.ZodError): HabitFieldErrors {
  const out: HabitFieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (HABIT_FIELDS.has(key) && !out[key as HabitField]) {
      out[key as HabitField] = issue.message;
    }
  }
  return out;
}

export const checkInSchema = z.object({
  habitId: z.uuid("Invalid habit"),
  count: z.coerce
    .number({ error: "Count must be a number" })
    .int("Count must be a whole number")
    .min(0, "Count can't be negative")
    .max(9999, "Count is too large"),
  minutes: z.coerce
    .number({ error: "Minutes must be a number" })
    .int("Minutes must be a whole number")
    .min(0, "Minutes can't be negative")
    .max(44_640, "Minutes is too large"),
  note: z
    .string()
    .trim()
    .max(500, "Note must be at most 500 characters")
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type CheckInFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"count" | "minutes" | "note", string>>;
  ok?: boolean;
};
