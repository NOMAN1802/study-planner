import {
  isActivePeriod,
  listPeriodStarts,
  nextPeriodStart,
  parseLocalDateTime,
  periodStart,
  previousPeriodStart,
  toLocalDateTimeInput,
  type Frequency,
  type PeriodContext,
  type WeekStart,
} from "@/lib/dates";

// Deterministic demo data for `pnpm db:seed`. Pure: no database access, so the
// shape and invariants are unit-tested (tests/unit/lib/demo-data.test.ts).

export type DemoZone = { timezone: string; weekStartsOn: WeekStart };

export type DemoHabit = {
  key: string;
  name: string;
  note: string | null;
  color: string;
  icon: string;
  frequency: Frequency;
  targetCount: number | null;
  targetMinutes: number | null;
  activeHours: number[];
  createdAt: Date;
  logs: { periodStart: Date; count: number; minutes: number; note: string | null }[];
};

export type DemoSession = {
  type: "FOCUS" | "SHORT_BREAK";
  plannedMinutes: number;
  startedAt: Date;
  endedAt: Date;
  completed: boolean;
};

export type DemoTask = {
  key: string;
  title: string;
  note: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueAt: Date | null;
  targetMinutes: number | null;
  actualMinutes: number;
  completedAt: Date | null;
  habitKey: string | null;
  sessions: DemoSession[];
};

export type DemoBlock = {
  title: string | null;
  startAt: Date;
  endAt: Date;
  taskKey: string | null;
  habitKey: string | null;
};

export type DemoData = { habits: DemoHabit[]; tasks: DemoTask[]; blocks: DemoBlock[] };

const MIN = 60_000;

/** Small seeded PRNG (mulberry32) so every run produces the same history. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoData(now: Date, zone: DemoZone): DemoData {
  const rand = prng(20261116);
  const ctx = (frequency: Frequency): PeriodContext => ({ frequency, ...zone });
  const daily = ctx("DAILY");

  // day[0] = start of today, day[n] = start of the local day n days ago.
  const day: Date[] = [periodStart(now, daily)];
  for (let i = 1; i <= 70; i += 1) day.push(previousPeriodStart(day[i - 1], daily));
  /** Wall-clock time on the local day `offset` days from today (negative = past). */
  const at = (offset: number, hhmm: string): Date => {
    let d = day[0];
    if (offset <= 0) d = day[-offset];
    else for (let i = 0; i < offset; i += 1) d = nextPeriodStart(d, daily);
    const date = toLocalDateTimeInput(d, zone.timezone).slice(0, 10);
    return parseLocalDateTime(`${date}T${hhmm}`, zone.timezone) ?? d;
  };

  // ---------- Habits ----------
  type Spec = Omit<DemoHabit, "logs" | "createdAt"> & {
    /** How far back the history goes. */
    since: Date;
    /** Chance a past period was completed. */
    rate: number;
    /** Most recent past periods that are always complete (the live streak). */
    streak: number;
    /** Progress in the current period, as a fraction of the target. */
    today: number;
  };
  const specs: Spec[] = [
    {
      key: "read",
      name: "Read",
      note: "Twenty minutes, before any screens.",
      color: "#0f766e",
      icon: "book-open",
      frequency: "DAILY",
      targetCount: null,
      targetMinutes: 20,
      activeHours: [],
      since: day[60],
      rate: 0.8,
      streak: 6,
      today: 0.5,
    },
    {
      key: "meditate",
      name: "Meditate",
      note: null,
      color: "#475569",
      icon: "brain",
      frequency: "DAILY",
      targetCount: 1,
      targetMinutes: null,
      activeHours: [],
      since: day[45],
      rate: 0.6,
      streak: 2,
      today: 1,
    },
    {
      key: "water",
      name: "Drink water",
      note: "One glass an hour during the workday.",
      color: "#3f7d3a",
      icon: "droplet",
      frequency: "HOURLY",
      targetCount: 1,
      targetMinutes: null,
      activeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
      since: day[6],
      rate: 0.7,
      streak: 2,
      today: 0,
    },
    {
      key: "workout",
      name: "Workout",
      note: "Strength or a run.",
      color: "#c2410c",
      icon: "dumbbell",
      frequency: "WEEKLY",
      targetCount: 3,
      targetMinutes: null,
      activeHours: [],
      since: day[63],
      rate: 0.7,
      streak: 3,
      today: 1 / 3,
    },
    {
      key: "finances",
      name: "Review finances",
      note: null,
      color: "#a16207",
      icon: "pen-line",
      frequency: "MONTHLY",
      targetCount: 1,
      targetMinutes: null,
      activeHours: [],
      since: day[70],
      rate: 0.9,
      streak: 1,
      today: 0,
    },
  ];

  const habits: DemoHabit[] = specs.map(({ since, rate, streak, today, ...habit }) => {
    const c = ctx(habit.frequency);
    const periods = listPeriodStarts(since, now, c).filter((p) =>
      isActivePeriod(p, c, habit.activeHours),
    );
    const current = periodStart(now, c).getTime();
    const past = periods.filter((p) => p.getTime() < current);
    const amount = (fraction: number) => ({
      count: habit.targetCount ? Math.round(habit.targetCount * fraction) : 0,
      minutes: habit.targetMinutes ? Math.round(habit.targetMinutes * fraction) : 0,
    });

    const logs: DemoHabit["logs"] = [];
    past.forEach((p, i) => {
      const fromEnd = past.length - i;
      // The period just before the live streak is always missed, so the streak length is exact.
      const done = fromEnd <= streak ? true : fromEnd === streak + 1 ? false : rand() < rate;
      const partial = !done && rand() < 0.3 ? amount(0.5) : null;
      const value = done ? amount(1) : partial;
      if (value && value.count + value.minutes > 0) {
        logs.push({ periodStart: p, ...value, note: null });
      }
    });
    const now_ = amount(today);
    if (periods.some((p) => p.getTime() === current) && now_.count + now_.minutes > 0) {
      logs.push({
        periodStart: new Date(current),
        ...now_,
        note: habit.key === "read" ? "Halfway through chapter 4." : null,
      });
    }
    return { ...habit, createdAt: since, logs };
  });

  // ---------- Tasks and focus sessions ----------
  /** Completed 25-minute focus sessions (each followed by a 5-minute break) on past days. */
  const focusRun = (offset: number, hhmm: string, count: number): DemoSession[] => {
    const out: DemoSession[] = [];
    let start = at(offset, hhmm);
    for (let i = 0; i < count; i += 1) {
      const end = new Date(start.getTime() + 25 * MIN);
      const breakEnd = new Date(end.getTime() + 5 * MIN);
      if (breakEnd.getTime() > now.getTime()) break;
      out.push({
        type: "FOCUS",
        plannedMinutes: 25,
        startedAt: start,
        endedAt: end,
        completed: true,
      });
      out.push({
        type: "SHORT_BREAK",
        plannedMinutes: 5,
        startedAt: end,
        endedAt: breakEnd,
        completed: true,
      });
      start = breakEnd;
    }
    return out;
  };

  type TaskSpec = Omit<DemoTask, "actualMinutes" | "completedAt"> & { doneAt?: Date };
  const taskSpecs: TaskSpec[] = [
    {
      key: "proposal",
      title: "Draft project proposal",
      note: "Outline, budget table, and a one-page summary.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueAt: at(1, "17:00"),
      targetMinutes: 180,
      habitKey: null,
      sessions: [
        ...focusRun(-6, "09:30", 2),
        ...focusRun(-3, "10:00", 2),
        ...focusRun(-1, "09:00", 1),
      ],
    },
    {
      key: "chapter",
      title: "Finish chapter 4 notes",
      note: null,
      status: "TODO",
      priority: "MEDIUM",
      dueAt: at(0, "21:00"),
      targetMinutes: 45,
      habitKey: "read",
      sessions: [],
    },
    {
      key: "invoice",
      title: "Send October invoices",
      note: null,
      status: "TODO",
      priority: "URGENT",
      dueAt: at(-2, "12:00"),
      targetMinutes: 30,
      habitKey: null,
      sessions: [],
    },
    {
      key: "refactor",
      title: "Refactor import script",
      note: "Split parsing from validation.",
      status: "DONE",
      priority: "MEDIUM",
      dueAt: at(-4, "18:00"),
      targetMinutes: 100,
      habitKey: null,
      doneAt: at(-4, "16:10"),
      sessions: [
        ...focusRun(-9, "14:00", 2),
        ...focusRun(-5, "11:00", 2),
        ...focusRun(-4, "14:00", 1),
      ],
    },
    {
      key: "slides",
      title: "Prepare demo slides",
      note: null,
      status: "TODO",
      priority: "LOW",
      dueAt: at(5, "10:00"),
      targetMinutes: 60,
      habitKey: null,
      sessions: focusRun(-2, "15:00", 1),
    },
    {
      key: "dentist",
      title: "Book dentist appointment",
      note: null,
      status: "DONE",
      priority: "LOW",
      dueAt: null,
      targetMinutes: null,
      habitKey: null,
      doneAt: at(-1, "13:00"),
      sessions: [],
    },
  ];
  const tasks: DemoTask[] = taskSpecs.map(({ doneAt, ...task }) => ({
    ...task,
    actualMinutes: task.sessions
      .filter((s) => s.type === "FOCUS" && s.completed)
      .reduce((sum, s) => sum + s.plannedMinutes, 0),
    completedAt: task.status === "DONE" ? (doneAt ?? now) : null,
  }));

  // ---------- Planner ----------
  const block = (
    offset: number,
    from: string,
    to: string,
    ref: { taskKey?: string; habitKey?: string; title?: string },
  ): DemoBlock => ({
    title: ref.title ?? null,
    startAt: at(offset, from),
    endAt: at(offset, to),
    taskKey: ref.taskKey ?? null,
    habitKey: ref.habitKey ?? null,
  });
  const blocks: DemoBlock[] = [
    block(0, "07:30", "08:00", { habitKey: "read" }),
    block(0, "09:00", "10:30", { taskKey: "proposal" }),
    block(0, "11:00", "11:30", { taskKey: "invoice" }),
    block(0, "18:00", "19:00", { habitKey: "workout" }),
    block(1, "09:00", "11:00", { taskKey: "proposal" }),
    block(1, "13:00", "13:45", { title: "Lunch walk" }),
    block(2, "10:00", "11:00", { taskKey: "slides" }),
    block(-1, "09:00", "09:30", { taskKey: "proposal" }),
  ];

  return { habits, tasks, blocks };
}
