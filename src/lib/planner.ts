/**
 * Planner math. Pure functions; times are epoch ms, days are local calendar
 * dates ("YYYY-MM-DD") in the user's timezone.
 */
import {
  listPeriodStarts,
  nextPeriodStart,
  parseLocalDateTime,
  periodStart,
  toLocalDateTimeInput,
  type PeriodContext,
  type WeekStart,
} from "@/lib/dates";

export type PlannerView = "day" | "week" | "month";
export const PLANNER_VIEWS: readonly PlannerView[] = ["day", "week", "month"];

export const MINUTE_MS = 60_000;
export const SNAP_MINUTES = 15;
export const MIN_BLOCK_MINUTES = 15;
export const MAX_BLOCK_MINUTES = 24 * 60;

export type DayInfo = {
  key: string;
  /** Local midnight, UTC ms. */
  start: number;
  /** Next local midnight (23 or 25 hours later on DST days). */
  end: number;
  /** Each local hour boundary within the day, UTC ms. */
  hours: number[];
};

export type Span = { start: number; end: number };

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DAY_KEY.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Calendar arithmetic on day keys (timezone-independent). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday for a calendar date. */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dayKeyOf(instant: Date | number, timezone: string): string {
  return toLocalDateTimeInput(new Date(instant), timezone).slice(0, 10);
}

const dailyCtx = (timezone: string): PeriodContext => ({
  frequency: "DAILY",
  timezone,
  weekStartsOn: 1,
});

export function dayInfo(key: string, timezone: string): DayInfo {
  // Noon always exists (DST changes happen at night), so anchor there.
  const noon = parseLocalDateTime(`${key}T12:00`, timezone) as Date;
  const start = periodStart(noon, dailyCtx(timezone));
  const end = nextPeriodStart(start, dailyCtx(timezone));
  const hours = listPeriodStarts(start, new Date(end.getTime() - 1), {
    frequency: "HOURLY",
    timezone,
    weekStartsOn: 1,
  }).map((d) => d.getTime());
  return { key, start: start.getTime(), end: end.getTime(), hours };
}

export function startOfWeekKey(key: string, weekStartsOn: WeekStart): string {
  return addDays(key, -((weekdayOf(key) - weekStartsOn + 7) % 7));
}

/** Full weeks covering the month containing `key`. */
export function monthWeeks(key: string, weekStartsOn: WeekStart): string[][] {
  const first = `${key.slice(0, 7)}-01`;
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const weeks: string[][] = [];
  for (let start = startOfWeekKey(first, weekStartsOn); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

export function viewDayKeys(view: PlannerView, key: string, weekStartsOn: WeekStart): string[] {
  if (view === "day") return [key];
  if (view === "week") {
    const start = startOfWeekKey(key, weekStartsOn);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  return monthWeeks(key, weekStartsOn).flat();
}

/** The date to show after pressing previous (-1) or next (+1). */
export function shiftKey(view: PlannerView, key: string, dir: -1 | 1): string {
  if (view === "day") return addDays(key, dir);
  if (view === "week") return addDays(key, 7 * dir);
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
}

export function parsePlannerParams(
  params: Record<string, string | string[] | undefined>,
  timezone: string,
  now: Date,
): { view: PlannerView; date: string } {
  const v = Array.isArray(params.view) ? params.view[0] : params.view;
  const d = Array.isArray(params.date) ? params.date[0] : params.date;
  return {
    view: (PLANNER_VIEWS as readonly string[]).includes(v ?? "") ? (v as PlannerView) : "week",
    date: isDayKey(d) ? d : dayKeyOf(now, timezone),
  };
}

// ---------- Geometry ----------

export function snapMinutes(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Part of a block that falls within a day, in minutes from the day's start. */
export function segmentInDay(
  block: Span,
  day: Pick<DayInfo, "start" | "end">,
): { top: number; height: number } | null {
  if (!overlaps(block, day)) return null;
  const from = Math.max(block.start, day.start);
  const to = Math.min(block.end, day.end);
  return { top: (from - day.start) / MINUTE_MS, height: (to - from) / MINUTE_MS };
}

/** Shift a block by whole snapped minutes, keeping its duration. */
export function moveBlock(block: Span, deltaMinutes: number): Span {
  const delta = snapMinutes(deltaMinutes) * MINUTE_MS;
  return { start: block.start + delta, end: block.end + delta };
}

/** Change a block's end, snapped, keeping at least the minimum duration. */
export function resizeBlock(block: Span, deltaMinutes: number): Span {
  const proposed = block.end + snapMinutes(deltaMinutes) * MINUTE_MS;
  const min = block.start + MIN_BLOCK_MINUTES * MINUTE_MS;
  const max = block.start + MAX_BLOCK_MINUTES * MINUTE_MS;
  return { start: block.start, end: Math.min(Math.max(proposed, min), max) };
}

/** Keeps a block's offset from local midnight while moving it to another day. */
export function moveToDay(block: Span, fromDayStart: number, toDayStart: number): Span {
  const delta = toDayStart - fromDayStart;
  return { start: block.start + delta, end: block.end + delta };
}

/** New block of `minutes` at `offsetMinutes` into the day, kept inside the day. */
export function blockAt(
  day: Pick<DayInfo, "start" | "end">,
  offsetMinutes: number,
  minutes: number,
): Span {
  const dayMinutes = (day.end - day.start) / MINUTE_MS;
  const duration = Math.min(Math.max(snapMinutes(minutes), MIN_BLOCK_MINUTES), dayMinutes);
  const top = Math.min(Math.max(snapMinutes(offsetMinutes), 0), dayMinutes - duration);
  return { start: day.start + top * MINUTE_MS, end: day.start + (top + duration) * MINUTE_MS };
}

export type Lane = { lane: number; lanes: number };

/**
 * Side-by-side layout for overlapping blocks (as in calendar apps). Blocks that
 * overlap transitively form a cluster; each gets the first free lane, and every
 * block in a cluster shares the cluster's lane count.
 */
export function layoutLanes<T extends Span & { id: string }>(
  blocks: readonly T[],
): Map<string, Lane> {
  const sorted = [...blocks].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id),
  );
  const result = new Map<string, Lane>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const c of cluster) result.set(c.id, { lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const b of sorted) {
    if (b.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.end);
    } else {
      laneEnds[lane] = b.end;
    }
    cluster.push({ id: b.id, lane });
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  flush();
  return result;
}

/** Ids of blocks that overlap at least one other block. */
export function conflictingIds<T extends Span & { id: string }>(blocks: readonly T[]): Set<string> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const out = new Set<string>();
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j += 1) {
      out.add(sorted[i].id);
      out.add(sorted[j].id);
    }
  }
  return out;
}

/** Sensible default duration for a dragged item. */
export function defaultBlockMinutes(item: {
  kind: "task" | "habit";
  targetMinutes: number | null;
  actualMinutes?: number;
}): number {
  const fallback = item.kind === "task" ? 60 : 30;
  const left = item.targetMinutes != null ? item.targetMinutes - (item.actualMinutes ?? 0) : null;
  const minutes = left != null && left > 0 ? left : fallback;
  return Math.min(Math.max(snapMinutes(minutes), MIN_BLOCK_MINUTES), 240);
}
