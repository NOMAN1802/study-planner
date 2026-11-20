import { z } from "zod";
import { isDayKey } from "@/lib/planner";
import { ROUTINE_KINDS, parseMinute } from "@/lib/workstation/routine";

export const EXAM_KINDS = ["DAILY", "WEEKLY", "SUBJECT_FINAL", "MOCK"] as const;
export type ExamKind = (typeof EXAM_KINDS)[number];
export const EXAM_LABEL: Record<ExamKind, string> = {
  DAILY: "Daily exam",
  WEEKLY: "Weekly exam",
  SUBJECT_FINAL: "Subject final",
  MOCK: "Mock test",
};

const dayKey = z.string({ error: "Pick a date" }).refine(isDayKey, "Pick a date");
const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

export const setupSchema = z.object({
  startDay: dayKey,
  learningDays: int("Learning days", 7, 365),
  revisionDays: int("Revision days", 0, 120),
});
export type SetupField = keyof z.input<typeof setupSchema>;

/** Comma-separated `YYYY-MM-DD` dates → sorted, unique list. */
const holidayList = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const days = [
      ...new Set(
        (v ?? "")
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      ),
    ].sort();
    if (days.some((d) => !isDayKey(d))) {
      ctx.addIssue({ code: "custom", message: "Pick valid dates" });
      return z.NEVER;
    }
    if (days.length > 60) {
      ctx.addIssue({ code: "custom", message: "At most 60 holidays" });
      return z.NEVER;
    }
    return days;
  });

export const planLengthSchema = setupSchema.extend({ holidays: holidayList });
export type PlanLengthField = keyof z.input<typeof planLengthSchema>;
export type PlanLengthState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<PlanLengthField, string>>;
};
export type SetupState = { error?: string; fieldErrors?: Partial<Record<SetupField, string>> };

const time = (label: string) =>
  z.string({ error: `Enter ${label}` }).transform((v, ctx) => {
    const m = parseMinute(v);
    if (m === null) {
      ctx.addIssue({ code: "custom", message: `Enter ${label} as HH:mm` });
      return z.NEVER;
    }
    return m;
  });

export const slotSchema = z
  .object({
    weekday: int("Day", 0, 6),
    start: time("a start time"),
    end: time("an end time"),
    kind: z.enum(ROUTINE_KINDS as [string, ...string[]], { error: "Pick a type" }),
    label: z
      .string({ error: "Label is required" })
      .trim()
      .min(1, "Label is required")
      .max(60, "Label must be at most 60 characters"),
  })
  .refine((v) => v.end > v.start, { message: "End must be after start", path: ["end"] });
export type SlotField = "weekday" | "start" | "end" | "kind" | "label";
export type SlotState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<SlotField, string>>;
};

const optionalNumber = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z
      .number({ error: `${label} must be a number` })
      .min(0, `${label} can't be negative`)
      .max(10_000, `${label} is too large`)
      .nullable(),
  );

export const examSchema = z
  .object({
    kind: z.enum(EXAM_KINDS, { error: "Pick an exam type" }),
    day: dayKey,
    subjectId: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.uuid("Pick a subject").nullable(),
    ),
    score: optionalNumber("Score"),
    total: optionalNumber("Total"),
    note: z
      .string()
      .trim()
      .max(500, "Note must be at most 500 characters")
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => v.kind !== "SUBJECT_FINAL" || v.subjectId !== null, {
    message: "Pick the subject",
    path: ["subjectId"],
  })
  .refine((v) => v.score === null || v.total === null || v.score <= v.total, {
    message: "Score can't be more than the total",
    path: ["score"],
  });
export type ExamField = "kind" | "day" | "subjectId" | "score" | "total" | "note";
export type ExamState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<ExamField, string>>;
};

export const estimateSchema = int("Estimate", 1, 20);

export function firstErrors<F extends string>(error: z.ZodError): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]) as F;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formValues<K extends string>(formData: FormData, keys: readonly K[]) {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k) ?? undefined])) as Record<
    K,
    FormDataEntryValue | undefined
  >;
}

/** Study Station sections, for old `?tab=` links (each is now its own page). */
export const WORKSTATION_TABS = [
  "today",
  "plan",
  "subjects",
  "exams",
  "office",
  "routine",
] as const;
export type WorkstationTab = (typeof WORKSTATION_TABS)[number];
export function parseTab(value: unknown): WorkstationTab {
  const v = Array.isArray(value) ? value[0] : value;
  return (WORKSTATION_TABS as readonly string[]).includes(v as string)
    ? (v as WorkstationTab)
    : "today";
}
