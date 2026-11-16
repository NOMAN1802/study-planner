import { describe, expect, it } from "vitest";
import {
  buildHeatmap,
  dailyHabitRing,
  dayKey,
  focusSeries,
  formatMinutes,
  habitsDueNow,
  heatmapStart,
  ringStat,
  streakRows,
  taskTimeRows,
  type HeatmapLog,
} from "@/lib/dashboard";

const dhaka = { timezone: "Asia/Dhaka", weekStartsOn: 1 as const };
const now = new Date("2026-11-15T10:00:00Z"); // Sun 15 Nov 16:00 Dhaka (UTC+6)

describe("dayKey", () => {
  it("uses the local calendar day", () => {
    expect(dayKey(new Date("2026-11-14T17:59:00Z"), "Asia/Dhaka")).toBe("2026-11-14");
    expect(dayKey(new Date("2026-11-14T18:00:00Z"), "Asia/Dhaka")).toBe("2026-11-15");
    expect(dayKey(new Date("2026-11-14T18:00:00Z"), "UTC")).toBe("2026-11-14");
  });
});

describe("focusSeries", () => {
  const entries = [
    { at: new Date("2026-11-15T03:30:00Z"), minutes: 25 }, // today 09:30
    { at: new Date("2026-11-15T03:59:59Z"), minutes: 10 }, // today 09:59
    { at: new Date("2026-11-14T17:59:00Z"), minutes: 50 }, // Sat 23:59
    { at: new Date("2026-11-08T17:59:00Z"), minutes: 15 }, // Sun 8 Nov 23:59 (previous week)
    { at: new Date("2026-10-31T17:59:00Z"), minutes: 99 }, // 31 Oct 23:59 (previous month)
    { at: new Date("2026-11-15T18:00:00Z"), minutes: 7 }, // tomorrow (next week)
  ];

  it("buckets today by local hour", () => {
    const s = focusSeries(entries, "day", now, dhaka);
    expect(s.buckets).toHaveLength(24);
    expect(s.buckets[0].label).toBe("00");
    expect(s.buckets[9]).toMatchObject({ label: "09", minutes: 35 });
    expect(s.total).toBe(35);
  });

  it("buckets the current week by local day, starting on the user's week start", () => {
    const s = focusSeries(entries, "week", now, dhaka);
    expect(s.buckets.map((b) => b.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(s.buckets.map((b) => b.minutes)).toEqual([0, 0, 0, 0, 0, 50, 35]);
    expect(s.total).toBe(85);

    const sunday = focusSeries(entries, "week", now, { ...dhaka, weekStartsOn: 0 });
    expect(sunday.buckets[0]).toMatchObject({ label: "Sun", minutes: 35 });
    expect(sunday.total).toBe(42); // today + tomorrow's entry (Mon 16 Nov is in a Sunday-start week)
  });

  it("buckets the current month by local day", () => {
    const s = focusSeries(entries, "month", now, dhaka);
    expect(s.buckets).toHaveLength(30);
    expect(s.buckets[0].label).toBe("1");
    expect(s.buckets[7].minutes).toBe(15); // 8 Nov
    expect(s.buckets[13].minutes).toBe(50); // 14 Nov
    expect(s.buckets[14].minutes).toBe(35); // 15 Nov
    expect(s.buckets[15].minutes).toBe(7); // 16 Nov
    expect(s.total).toBe(107);
  });

  it("handles a 25-hour day when clocks go back", () => {
    const ny = { timezone: "America/New_York", weekStartsOn: 1 as const };
    const s = focusSeries([], "day", new Date("2026-11-01T15:00:00Z"), ny);
    expect(s.buckets).toHaveLength(25);
    expect(new Set(s.buckets.map((b) => b.key)).size).toBe(25);
    expect(s.total).toBe(0);
  });
});

describe("buildHeatmap", () => {
  const log = (over: Partial<HeatmapLog>): HeatmapLog => ({
    habitId: "h1",
    frequency: "DAILY",
    periodStart: new Date("2026-11-14T18:00:00Z"), // 15 Nov local
    count: 1,
    minutes: 0,
    targetCount: null,
    targetMinutes: null,
    ...over,
  });

  it("covers 53 weeks ending in the current week, with no future days", () => {
    const h = buildHeatmap([], now, dhaka);
    expect(h.weeks).toHaveLength(53);
    expect(h.weeks.every((w) => w.length === 7)).toBe(true);
    expect(h.weeks[0][0]?.date).toBe("2025-11-10"); // a Monday
    expect(h.weeks[52][6]?.date).toBe("2026-11-15");
    expect(heatmapStart(now, dhaka)).toEqual(new Date("2025-11-09T18:00:00Z"));

    const sundayStart = buildHeatmap([], now, { ...dhaka, weekStartsOn: 0 });
    expect(sundayStart.weeks[52][0]?.date).toBe("2026-11-15");
    expect(sundayStart.weeks[52].slice(1)).toEqual([null, null, null, null, null, null]);
    expect(h.total).toBe(0);
    expect(h.activeDays).toBe(0);
  });

  it("counts distinct daily/hourly habits completed per local day", () => {
    const h = buildHeatmap(
      [
        log({}),
        log({ habitId: "h2", targetCount: 2, count: 2 }),
        log({ habitId: "h3", targetCount: 2, count: 1 }), // incomplete
        log({ habitId: "h4", frequency: "WEEKLY" }), // not a daily/hourly habit
        // hourly habit: two completed hours on the same day count once
        log({ habitId: "h5", frequency: "HOURLY", periodStart: new Date("2026-11-15T02:00:00Z") }),
        log({ habitId: "h5", frequency: "HOURLY", periodStart: new Date("2026-11-15T03:00:00Z") }),
        log({ periodStart: new Date("2026-11-13T18:00:00Z") }), // 14 Nov
        log({ periodStart: new Date("2024-01-01T00:00:00Z") }), // outside the window
      ],
      now,
      dhaka,
    );
    const cells = h.weeks.flat().filter((c) => c !== null);
    const at = (date: string) => cells.find((c) => c.date === date);
    expect(at("2026-11-15")).toMatchObject({ count: 3, level: 4 });
    expect(at("2026-11-14")).toMatchObject({ count: 1, level: 2 });
    expect(at("2026-11-13")).toMatchObject({ count: 0, level: 0 });
    expect(h.total).toBe(4);
    expect(h.activeDays).toBe(2);
    expect(h.max).toBe(3);
  });

  it("labels the week in which each month starts", () => {
    const h = buildHeatmap([], now, dhaka);
    expect(h.months[0]).toEqual({ week: 0, label: "Nov" });
    expect(h.months.map((m) => m.label).slice(0, 3)).toEqual(["Nov", "Dec", "Jan"]);
    expect(h.months.at(-1)?.label).toBe("Nov");
  });
});

describe("rings", () => {
  it("computes a ratio and tolerates an empty total", () => {
    expect(ringStat(1, 4)).toEqual({ done: 1, total: 4, ratio: 0.25 });
    expect(ringStat(0, 0)).toEqual({ done: 0, total: 0, ratio: 0 });
  });

  it("only counts daily habits", () => {
    expect(
      dailyHabitRing([
        { frequency: "DAILY", complete: true },
        { frequency: "DAILY", complete: false },
        { frequency: "WEEKLY", complete: true },
        { frequency: "HOURLY", complete: true },
      ]),
    ).toEqual({ done: 1, total: 2, ratio: 0.5 });
  });
});

describe("habitsDueNow", () => {
  it("drops hourly habits outside their active hours", () => {
    const habits = [
      { id: "a", frequency: "HOURLY" as const, activeNow: false },
      { id: "b", frequency: "HOURLY" as const, activeNow: true },
      { id: "c", frequency: "DAILY" as const, activeNow: true },
    ];
    expect(habitsDueNow(habits).map((h) => h.id)).toEqual(["b", "c"]);
  });
});

describe("streakRows", () => {
  it("sorts by current streak, then best streak, then name", () => {
    const h = (name: string, currentStreak: number, bestStreak: number) => ({
      name,
      stats: { currentStreak, bestStreak },
    });
    const rows = streakRows([h("b", 0, 5), h("a", 3, 3), h("d", 0, 5), h("c", 3, 9)]);
    expect(rows.map((r) => r.name)).toEqual(["c", "a", "b", "d"]);
  });
});

describe("taskTimeRows", () => {
  const t = (
    title: string,
    targetMinutes: number | null,
    actualMinutes: number,
    status = "TODO",
  ) => ({ id: title, title, status, targetMinutes, actualMinutes });

  it("keeps tasks with a target, open first, most time first", () => {
    const rows = taskTimeRows([
      t("done-over", 30, 40, "DONE"),
      t("no-target", null, 99),
      t("zero", 20, 0),
      t("part", 60, 45, "IN_PROGRESS"),
    ]);
    expect(rows.map((r) => r.title)).toEqual(["part", "zero", "done-over"]);
    expect(rows[0]).toMatchObject({
      target: 60,
      actual: 45,
      ratio: 0.75,
      over: false,
      done: false,
    });
    expect(rows[2]).toMatchObject({ over: true, done: true });
    expect(rows[2].ratio).toBeCloseTo(40 / 30);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => t(`t${i}`, 10, i));
    expect(taskTimeRows(many, 5)).toHaveLength(5);
  });
});

describe("formatMinutes", () => {
  it("formats minutes compactly", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(135)).toBe("2h 15m");
  });
});
