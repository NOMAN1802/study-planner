/**
 * Weekly routine math. Pure functions. A slot is a local wall-clock range
 * (minutes from midnight) on one weekday (0 = Sunday … 6 = Saturday).
 * One study cycle = 50 min focus + 10 min break = 60 minutes.
 */
import { toLocalDateTimeInput } from "@/lib/dates";
import { addDays, weekdayOf } from "@/lib/planner";

export type RoutineKind = "STUDY" | "OFFICE" | "PERSONAL";
export const ROUTINE_KINDS: readonly RoutineKind[] = ["STUDY", "OFFICE", "PERSONAL"];
export const KIND_LABEL: Record<RoutineKind, string> = {
  STUDY: "Study",
  OFFICE: "Office",
  PERSONAL: "Personal",
};

export type Slot = {
  id?: string;
  weekday: number;
  startMin: number;
  endMin: number;
  kind: RoutineKind;
  label: string;
};

export const CYCLE_MINUTES = 60;
export const FOCUS_MINUTES = 50;
export const BREAK_MINUTES = 10;

export const FRIDAY = 5;
export const SATURDAY = 6;
/** Saturday first: the week ends on the Friday holiday. */
export const WEEK_ORDER: readonly number[] = [6, 0, 1, 2, 3, 4, 5];
export const WEEKDAY_NAME = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const hm = (h: number, m = 0) => h * 60 + m;

const OFFICE_DAY: Omit<Slot, "weekday">[] = [
  { startMin: hm(5), endMin: hm(5, 30), kind: "PERSONAL", label: "Bath & prep" },
  { startMin: hm(5, 30), endMin: hm(8, 30), kind: "STUDY", label: "Morning study" },
  { startMin: hm(8, 30), endMin: hm(9), kind: "PERSONAL", label: "Commute" },
  { startMin: hm(9), endMin: hm(18), kind: "OFFICE", label: "Office" },
  { startMin: hm(18), endMin: hm(18, 50), kind: "PERSONAL", label: "Commute & rest" },
  { startMin: hm(18, 50), endMin: hm(22, 50), kind: "STUDY", label: "Evening study" },
  { startMin: hm(22, 50), endMin: hm(23), kind: "PERSONAL", label: "Get ready for bed" },
];

const HOLIDAY: Omit<Slot, "weekday">[] = [
  { startMin: hm(5), endMin: hm(5, 30), kind: "PERSONAL", label: "Bath & prep" },
  { startMin: hm(5, 30), endMin: hm(12, 30), kind: "STUDY", label: "Morning study" },
  { startMin: hm(12, 30), endMin: hm(14), kind: "PERSONAL", label: "Jumu'ah & lunch" },
  { startMin: hm(14), endMin: hm(18), kind: "STUDY", label: "Afternoon study" },
  { startMin: hm(18), endMin: hm(18, 50), kind: "PERSONAL", label: "Rest" },
  { startMin: hm(18, 50), endMin: hm(22, 50), kind: "STUDY", label: "Evening study" },
  { startMin: hm(22, 50), endMin: hm(23), kind: "PERSONAL", label: "Get ready for bed" },
];

/**
 * Office 09:00–18:00 Saturday–Thursday, Friday off. Sleep 23:00–05:00 every
 * night (6 hours), after 10 minutes getting ready for bed. Office days:
 * 3 cycles in the morning + 4 in the evening = 7; Friday (and holidays):
 * 7 + 4 + 4 = 15 — 57 a week.
 */
export function defaultRoutine(): Slot[] {
  return WEEK_ORDER.flatMap((weekday) =>
    (weekday === FRIDAY ? HOLIDAY : OFFICE_DAY).map((s) => ({ ...s, weekday })),
  );
}

export function slotCycles(slot: Pick<Slot, "kind" | "startMin" | "endMin">): number {
  if (slot.kind !== "STUDY") return 0;
  return Math.max(0, Math.floor((slot.endMin - slot.startMin) / CYCLE_MINUTES));
}

export function slotsForWeekday<T extends Slot>(slots: readonly T[], weekday: number): T[] {
  return slots.filter((s) => s.weekday === weekday).sort((a, b) => a.startMin - b.startMin);
}

export function dayCycles(slots: readonly Slot[], weekday: number): number {
  return slotsForWeekday(slots, weekday).reduce((n, s) => n + slotCycles(s), 0);
}

/** Study cycles available on each weekday, indexed 0 (Sun) … 6 (Sat). */
export function cyclesByWeekday(slots: readonly Slot[]): number[] {
  return Array.from({ length: 7 }, (_, d) => dayCycles(slots, d));
}

export function weekCycles(slots: readonly Slot[]): number {
  return cyclesByWeekday(slots).reduce((a, b) => a + b, 0);
}

export function cyclesOnDay(slots: readonly Slot[], dayKey: string): number {
  return dayCycles(slots, weekdayOf(dayKey));
}

/** Validation for one slot on its own. Returns a message or null. */
export function slotProblem(slot: Pick<Slot, "weekday" | "startMin" | "endMin">): string | null {
  if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) return "Pick a day";
  if (slot.startMin < 0 || slot.endMin > 24 * 60) return "Times must be within the day";
  if (slot.endMin <= slot.startMin) return "End must be after start";
  return null;
}

/** The first slot that overlaps `slot` on the same weekday (ignoring itself). */
export function overlappingSlot<T extends Slot>(slots: readonly T[], slot: Slot): T | null {
  return (
    slots.find(
      (s) =>
        s.weekday === slot.weekday &&
        (slot.id === undefined || s.id !== slot.id) &&
        s.startMin < slot.endMin &&
        slot.startMin < s.endMin,
    ) ?? null
  );
}

/** The 50/10 cycles inside a study slot, as [focusStart, breakStart, end] minutes. */
export function cycleMarks(slot: Pick<Slot, "kind" | "startMin" | "endMin">) {
  return Array.from({ length: slotCycles(slot) }, (_, i) => {
    const start = slot.startMin + i * CYCLE_MINUTES;
    return { start, breakAt: start + FOCUS_MINUTES, end: start + CYCLE_MINUTES };
  });
}

/**
 * Study days follow the calendar, from the morning: a date's study day runs
 * from 03:00 (before the 05:00 wake-up) to 03:00 the next morning, so a
 * session that runs past midnight still counts for the day it started.
 */
export const DAY_START_MIN = 3 * 60;

/** The study day a local wall-clock moment belongs to. */
export function studyDayOf(calendarDay: string, minute: number): string {
  return minute < DAY_START_MIN ? addDays(calendarDay, -1) : calendarDay;
}

export type LocalNow = {
  /** The current study day (see DAY_START_MIN). */
  dayKey: string;
  /** Weekday of the study day. */
  weekday: number;
  /** Local wall-clock minute (0–1439). */
  minute: number;
};

export function localNow(now: Date, timezone: string): LocalNow {
  const local = toLocalDateTimeInput(now, timezone); // YYYY-MM-DDTHH:mm
  const minute = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const dayKey = studyDayOf(local.slice(0, 10), minute);
  return { dayKey, weekday: weekdayOf(dayKey), minute };
}

/** The study day an instant belongs to, in the user's timezone. */
export function studyDayKeyOf(instant: Date, timezone: string): string {
  return localNow(instant, timezone).dayKey;
}

/**
 * The slots of one study day, in order: this weekday's slots from 03:00, then
 * any slots of the next weekday that start after midnight but before 03:00.
 * A holiday follows Friday's (the weekly off day) routine.
 */
export function studyDaySlots<T extends Slot>(
  slots: readonly T[],
  weekday: number,
  holiday = false,
): T[] {
  const day = slotsForWeekday(slots, holiday ? FRIDAY : weekday).filter(
    (s) => s.startMin >= DAY_START_MIN,
  );
  const night = slotsForWeekday(slots, (weekday + 1) % 7).filter((s) => s.startMin < DAY_START_MIN);
  return [...day, ...night];
}

/** Study cycles in each study day, indexed by its weekday 0 (Sun) … 6 (Sat). */
export function studyCyclesByWeekday(slots: readonly Slot[], holiday = false): number[] {
  return Array.from({ length: 7 }, (_, w) =>
    studyDaySlots(slots, w, holiday).reduce((n, s) => n + slotCycles(s), 0),
  );
}

export function slotAt<T extends Slot>(slots: readonly T[], weekday: number, minute: number) {
  return slots.find((s) => s.weekday === weekday && s.startMin <= minute && minute < s.endMin);
}

export function formatMinute(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:mm" → minutes, or null. Accepts "24:00" as end of day. */
export function parseMinute(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}
