import { TZDate } from "@date-fns/tz";

export type Frequency = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";
/** 0 = Sunday … 6 = Saturday (same convention as Date#getDay). */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PeriodContext = {
  frequency: Frequency;
  timezone: string;
  weekStartsOn: WeekStart;
};

const HOUR_MS = 60 * 60 * 1000;

function inZone(instant: Date | number, timezone: string): TZDate {
  return new TZDate(typeof instant === "number" ? instant : instant.getTime(), timezone);
}

function toUtc(date: TZDate): Date {
  return new Date(date.getTime());
}

/**
 * The UTC instant at which the period containing `instant` begins, where the
 * period boundaries are computed in the user's timezone.
 */
export function periodStart(instant: Date, ctx: PeriodContext): Date {
  const d = inZone(instant, ctx.timezone);
  switch (ctx.frequency) {
    case "HOURLY":
      d.setMinutes(0, 0, 0);
      break;
    case "DAILY":
      d.setHours(0, 0, 0, 0);
      break;
    case "WEEKLY": {
      const diff = (d.getDay() - ctx.weekStartsOn + 7) % 7;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      break;
    }
    case "MONTHLY":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  return toUtc(d);
}

/** Start of the period after the one beginning at `start`. */
export function nextPeriodStart(start: Date, ctx: PeriodContext): Date {
  if (ctx.frequency === "HOURLY") {
    return new Date(start.getTime() + HOUR_MS);
  }
  const d = inZone(start, ctx.timezone);
  if (ctx.frequency === "DAILY") d.setDate(d.getDate() + 1);
  if (ctx.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
  if (ctx.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  // Re-normalise: guards against DST shifting the wall clock off midnight.
  return periodStart(toUtc(d), ctx);
}

/** Start of the period before the one beginning at `start`. */
export function previousPeriodStart(start: Date, ctx: PeriodContext): Date {
  // Any instant just before `start` lies in the previous period.
  return periodStart(new Date(start.getTime() - 1), ctx);
}

/** Exclusive end of the period beginning at `start`. */
export function periodEnd(start: Date, ctx: PeriodContext): Date {
  return nextPeriodStart(start, ctx);
}

/** Local hour (0–23) in `timezone` at `instant`. */
export function localHour(instant: Date, timezone: string): number {
  return inZone(instant, timezone).getHours();
}

/**
 * Whether a period counts towards streaks/rates. Only HOURLY habits can have
 * inactive periods (hours outside `activeHours`); an empty list means all hours.
 */
export function isActivePeriod(
  start: Date,
  ctx: PeriodContext,
  activeHours: readonly number[],
): boolean {
  if (ctx.frequency !== "HOURLY" || activeHours.length === 0) return true;
  return activeHours.includes(localHour(start, ctx.timezone));
}

/**
 * All period starts from the period containing `from` up to and including the
 * period containing `to`, oldest first.
 */
export function listPeriodStarts(from: Date, to: Date, ctx: PeriodContext): Date[] {
  const out: Date[] = [];
  const last = periodStart(to, ctx).getTime();
  for (let p = periodStart(from, ctx); p.getTime() <= last; p = nextPeriodStart(p, ctx)) {
    out.push(p);
  }
  return out;
}

/** Stable map key for a period start. */
export function periodKey(start: Date): string {
  return start.toISOString();
}

const PERIOD_NOUN: Record<Frequency, [string, string]> = {
  HOURLY: ["hour", "hours"],
  DAILY: ["day", "days"],
  WEEKLY: ["week", "weeks"],
  MONTHLY: ["month", "months"],
};

export function periodNoun(frequency: Frequency, count: number): string {
  const [one, many] = PERIOD_NOUN[frequency];
  return count === 1 ? one : many;
}

const THIS_PERIOD: Record<Frequency, string> = {
  HOURLY: "this hour",
  DAILY: "today",
  WEEKLY: "this week",
  MONTHLY: "this month",
};

export function currentPeriodLabel(frequency: Frequency): string {
  return THIS_PERIOD[frequency];
}

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Parses a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") as wall-clock
 * time in `timezone` and returns the UTC instant. Returns null for invalid input.
 */
export function parseLocalDateTime(value: string, timezone: string): Date | null {
  const m = LOCAL_DATETIME.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const date = new TZDate(y, mo - 1, d, h, mi, timezone);
  // Reject overflow such as 31 February.
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return new Date(date.getTime());
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Formats a UTC instant as a datetime-local value in `timezone`. */
export function toLocalDateTimeInput(instant: Date, timezone: string): string {
  const d = inZone(instant, timezone);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Short, human due label in the user's timezone:
 * "Today 14:00", "Tomorrow 09:30", "Yesterday 18:00", "Mon 17 Nov 10:00", "17 Nov 2027 10:00".
 */
export function formatDue(due: Date, timezone: string, now: Date): string {
  const daily: PeriodContext = { frequency: "DAILY", timezone, weekStartsOn: 1 };
  const dueDay = periodStart(due, daily).getTime();
  const today = periodStart(now, daily);
  const tomorrow = nextPeriodStart(today, daily).getTime();
  const yesterday = previousPeriodStart(today, daily).getTime();
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(due);

  if (dueDay === today.getTime()) return `Today ${time}`;
  if (dueDay === tomorrow) return `Tomorrow ${time}`;
  if (dueDay === yesterday) return `Yesterday ${time}`;

  const sameYear = inZone(due, timezone).getFullYear() === inZone(now, timezone).getFullYear();
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    ...(sameYear
      ? { weekday: "short", day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" }),
  })
    .format(due)
    .replace(",", "");
  return `${date} ${time}`;
}
