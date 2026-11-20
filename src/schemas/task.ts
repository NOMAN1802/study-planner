import { z } from "zod";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
/** Categories a user can pick. STUDY tasks are created by Study Station only. */
export const TASK_CATEGORIES = ["GENERAL", "OFFICE"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number] | "STUDY";
export const CATEGORY_LABEL: Record<(typeof TASK_CATEGORIES)[number], string> = {
  GENERAL: "Personal",
  OFFICE: "Office",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

/**
 * Raw form input. `dueAt` stays a datetime-local string here; the server action
 * converts it to UTC using the user's timezone.
 */
export const taskSchema = z.object({
  title: z
    .string({ error: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be at most 120 characters"),
  note: z
    .string()
    .trim()
    .max(2000, "Note must be at most 2000 characters")
    .nullish()
    .transform((v) => (v ? v : null)),
  status: z.enum(TASK_STATUSES, { error: "Pick a status" }).default("TODO"),
  priority: z.enum(TASK_PRIORITIES, { error: "Pick a priority" }).default("MEDIUM"),
  dueAt: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid date and time")
      .nullable(),
  ),
  targetMinutes: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z
      .number({ error: "Target minutes must be a number" })
      .int("Target minutes must be a whole number")
      .min(1, "Target minutes must be at least 1")
      .max(10_000, "Target minutes must be at most 10000")
      .nullable(),
  ),
  habitId: z.preprocess(emptyToNull, z.uuid("Pick a habit").nullable()),
  category: z.enum(TASK_CATEGORIES, { error: "Pick a category" }).default("GENERAL"),
});

export type TaskInput = z.output<typeof taskSchema>;
export type TaskField =
  "title" | "note" | "status" | "priority" | "dueAt" | "targetMinutes" | "habitId" | "category";
export type TaskFieldErrors = Partial<Record<TaskField, string>>;
export type TaskFormState = { error?: string; fieldErrors?: TaskFieldErrors };

const FIELDS = new Set<string>([
  "title",
  "note",
  "status",
  "priority",
  "dueAt",
  "targetMinutes",
  "habitId",
  "category",
]);

export function taskFieldErrors(error: z.ZodError): TaskFieldErrors {
  const out: TaskFieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (FIELDS.has(key) && !out[key as TaskField]) out[key as TaskField] = issue.message;
  }
  return out;
}

export function taskFormValues(formData: FormData) {
  return {
    title: formData.get("title"),
    note: formData.get("note"),
    status: formData.get("status") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    dueAt: formData.get("dueAt"),
    targetMinutes: formData.get("targetMinutes"),
    habitId: formData.get("habitId"),
    category: formData.get("category") ?? undefined,
  };
}

// ---------- List filters (from URL search params) ----------

export const STATUS_FILTERS = ["open", "all", ...TASK_STATUSES] as const;
export const DUE_FILTERS = ["all", "overdue", "today", "week", "none"] as const;
export const SORTS = ["due", "priority", "created", "title"] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];
export type DueFilter = (typeof DUE_FILTERS)[number];
export type TaskSort = (typeof SORTS)[number];

export type TaskFilters = {
  status: StatusFilter;
  priority: TaskPriority | "all";
  due: DueFilter;
  sort: TaskSort;
};

export const DEFAULT_FILTERS: TaskFilters = {
  status: "open",
  priority: "all",
  due: "all",
  sort: "due",
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Unknown or malformed params fall back to defaults instead of erroring. */
export function parseTaskFilters(
  params: Record<string, string | string[] | undefined>,
): TaskFilters {
  return {
    status: pick(params.status, STATUS_FILTERS, DEFAULT_FILTERS.status),
    priority: pick(params.priority, ["all", ...TASK_PRIORITIES] as const, "all"),
    due: pick(params.due, DUE_FILTERS, DEFAULT_FILTERS.due),
    sort: pick(params.sort, SORTS, DEFAULT_FILTERS.sort),
  };
}

export function isDefaultFilters(f: TaskFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof TaskFilters)[]).every(
    (k) => f[k] === DEFAULT_FILTERS[k],
  );
}
