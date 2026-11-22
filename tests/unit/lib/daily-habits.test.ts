import { describe, expect, it } from "vitest";
import {
  DAILY_SET,
  MAX_RANGE_DAYS,
  PRAYERS,
  buildReport,
  dayScores,
  dayValue,
  daysBetween,
  isChecklistHabit,
  missingPresets,
  rangeLabel,
  rangeQuery,
  resolveRange,
  streaks,
  toggledParts,
  type ReportHabit,
} from "@/lib/daily-habits";

const habit = (id: string, extra: Partial<ReportHabit> = {}): ReportHabit => ({
  id,
  name: id,
  icon: "circle",
  color: "#000",
  preset: null,
  parts: [],
  firstDay: "2026-11-01",
  archivedDay: null,
  ...extra,
});

describe("daily set", () => {
  it("has the 10 habits with correctly spelled prayers and an automatic study habit", () => {
    expect(DAILY_SET).toHaveLength(10);
    expect(DAILY_SET[0].parts).toEqual(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
    expect(DAILY_SET.filter((p) => p.auto === "study").map((p) => p.name)).toEqual([
      "Study at least 7 hours",
    ]);
    expect(new Set(DAILY_SET.map((p) => p.preset)).size).toBe(10);
  });

  it("only adds the presets that are missing", () => {
    expect(missingPresets([])).toHaveLength(10);
    expect(missingPresets(["prayer", "study", null]).map((p) => p.preset)).not.toContain("prayer");
    expect(missingPresets(DAILY_SET.map((p) => p.preset))).toEqual([]);
  });

  it("puts daily single-tick habits on the checklist, not count, minute or weekly ones", () => {
    const base = { preset: null, parts: [], targetCount: null, targetMinutes: null };
    expect(isChecklistHabit({ ...base, frequency: "DAILY" })).toBe(true);
    expect(isChecklistHabit({ ...base, frequency: "DAILY", targetCount: 1 })).toBe(true);
    expect(isChecklistHabit({ ...base, frequency: "DAILY", targetCount: 8 })).toBe(false);
    expect(isChecklistHabit({ ...base, frequency: "DAILY", targetMinutes: 30 })).toBe(false);
    expect(isChecklistHabit({ ...base, frequency: "WEEKLY" })).toBe(false);
    expect(
      isChecklistHabit({ ...base, frequency: "DAILY", preset: "prayer", targetCount: 5 }),
    ).toBe(true);
  });
});

describe("dayValue", () => {
  it("counts prayers in fifths", () => {
    const prayer = { parts: PRAYERS };
    expect(dayValue(prayer, undefined)).toBe(0);
    expect(dayValue(prayer, { count: 3, parts: [0, 2, 4] })).toBeCloseTo(0.6);
    expect(dayValue(prayer, { count: 5, parts: [0, 1, 2, 3, 4] })).toBe(1);
    // Out-of-range and repeated parts are ignored.
    expect(dayValue(prayer, { count: 3, parts: [0, 0, 9] })).toBeCloseTo(0.2);
  });

  it("is ticked or not for single habits", () => {
    expect(dayValue({ parts: [] }, { count: 1, parts: [] })).toBe(1);
    expect(dayValue({ parts: [] }, { count: 0, parts: [] })).toBe(0);
  });

  it("marks study done at 7 hours from the Study Station", () => {
    expect(dayValue({ parts: [], auto: "study" }, undefined, 6)).toBe(0);
    expect(dayValue({ parts: [], auto: "study" }, undefined, 7)).toBe(1);
    // A manual tick never counts for the study habit.
    expect(dayValue({ parts: [], auto: "study" }, { count: 1, parts: [] }, 2)).toBe(0);
  });

  it("toggles parts in order without duplicates", () => {
    expect(toggledParts([3, 0], 1, true)).toEqual([0, 1, 3]);
    expect(toggledParts([0, 1], 1, true)).toEqual([0, 1]);
    expect(toggledParts([0, 1, 3], 1, false)).toEqual([0, 3]);
  });
});

describe("resolveRange", () => {
  const today = "2026-11-22"; // a Sunday

  it("defaults to this month", () => {
    expect(resolveRange({}, today, 1)).toMatchObject({
      kind: "month",
      from: "2026-11-01",
      to: "2026-11-30",
      prev: "2026-10-01",
      next: "2026-12-01",
    });
  });

  it("builds day, week (from the settings week start) and year ranges", () => {
    expect(resolveRange({ range: "day", date: "2026-11-20" }, today, 1)).toMatchObject({
      from: "2026-11-20",
      to: "2026-11-20",
      prev: "2026-11-19",
      next: "2026-11-21",
    });
    expect(resolveRange({ range: "week" }, today, 1)).toMatchObject({
      from: "2026-11-16",
      to: "2026-11-22",
    });
    expect(resolveRange({ range: "week" }, today, 6)).toMatchObject({
      from: "2026-11-21",
      to: "2026-11-27",
    });
    expect(resolveRange({ range: "year", date: "2026-03-04" }, today, 1)).toMatchObject({
      from: "2026-01-01",
      to: "2026-12-31",
      prev: "2025-01-01",
    });
  });

  it("handles month ends and leap years", () => {
    expect(resolveRange({ range: "month", date: "2028-02-10" }, today, 1).to).toBe("2028-02-29");
    expect(resolveRange({ range: "month", date: "2026-01-31" }, today, 1).next).toBe("2026-02-01");
  });

  it("swaps a reversed custom range and caps its length", () => {
    expect(
      resolveRange({ range: "custom", from: "2026-11-10", to: "2026-11-01" }, today, 1),
    ).toMatchObject({ from: "2026-11-01", to: "2026-11-10", prev: null, next: null });
    const long = resolveRange({ range: "custom", from: "2000-01-01", to: today }, today, 1);
    expect(daysBetween(long.from, long.to) + 1).toBe(MAX_RANGE_DAYS);
  });

  it("ignores invalid values", () => {
    expect(resolveRange({ range: "decade", date: "2026-02-31" }, today, 1)).toMatchObject({
      kind: "month",
      from: "2026-11-01",
    });
    expect(resolveRange({ range: "custom", from: "nope" }, today, 1)).toMatchObject({
      from: "2026-10-24",
      to: today,
    });
  });

  it("labels and serialises ranges", () => {
    expect(rangeLabel(resolveRange({}, today, 1))).toBe("November 2026");
    expect(rangeLabel(resolveRange({ range: "year" }, today, 1))).toBe("2026");
    expect(rangeQuery("week", "2026-11-22")).toBe("range=week&date=2026-11-22");
    expect(rangeQuery("custom", today, "2026-11-01", "2026-11-05")).toBe(
      "range=custom&from=2026-11-01&to=2026-11-05",
    );
  });
});

describe("streaks", () => {
  const days = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];

  it("finds the current and best run; today not done yet keeps the run", () => {
    const hit = new Map([
      ["2026-11-01", true],
      ["2026-11-02", true],
      ["2026-11-03", false],
      ["2026-11-04", true],
      ["2026-11-05", false],
    ]);
    expect(streaks(days, (d) => hit.get(d) ?? null, "2026-11-05")).toEqual({ current: 1, best: 2 });
    // Yesterday missed: the run is broken.
    expect(streaks(days.slice(0, 3), (d) => hit.get(d) ?? null, "2026-11-04")).toEqual({
      current: 0,
      best: 2,
    });
  });

  it("skips days that don't count", () => {
    const hit = (d: string) => (d === "2026-11-02" ? null : true);
    expect(streaks(days, hit, "2026-11-05")).toEqual({ current: 4, best: 4 });
  });
});

describe("buildReport", () => {
  const today = "2026-11-04";
  const habits = [
    habit("prayer", { parts: PRAYERS, preset: "prayer" }),
    habit("quran"),
    habit("late", { firstDay: "2026-11-03" }),
  ];
  const values = {
    "2026-11-01": { prayer: 1, quran: 1 },
    "2026-11-02": { prayer: 0.6, quran: 1 },
    "2026-11-03": { prayer: 1, quran: 1, late: 1 },
    "2026-11-04": { prayer: 0.4 },
  };

  it("scores each day over the habits that count that day", () => {
    const s = dayScores(habits, values, ["2026-11-02", "2026-11-03", "2026-11-05"], today);
    expect(s[0]).toMatchObject({ done: 1.6, possible: 2, pct: 80, perfect: false });
    expect(s[1]).toMatchObject({ done: 3, possible: 3, pct: 100, perfect: true });
    expect(s[2]).toMatchObject({ possible: 0, pct: null }); // future
  });

  it("computes the KPIs for a range, ignoring days after today", () => {
    const r = buildReport({
      habits,
      values,
      from: "2026-11-01",
      to: "2026-11-30",
      today,
      historyFrom: "2026-11-01",
    });
    expect(r.through).toBe(today);
    expect(r.countedDays).toBe(4);
    // Done: 2 + 1.6 + 3 + 0.4 = 7 of 2 + 2 + 3 + 3 = 10.
    expect(r.completionPct).toBe(70);
    // Day scores 100, 80, 100, 13 → 73.25.
    expect(r.averageScore).toBe(73);
    expect(r.perfectDays).toBe(2);
    expect(r.currentStreak).toBe(1); // 3rd perfect, today (4th) not yet
    expect(r.bestStreak).toBe(1);

    const prayer = r.habits.find((h) => h.id === "prayer")!;
    expect(prayer).toMatchObject({ done: 2, possible: 4, pct: 75 });
    const quran = r.habits.find((h) => h.id === "quran")!;
    expect(quran).toMatchObject({ done: 3, possible: 4, pct: 75, currentStreak: 3, bestStreak: 3 });
    const late = r.habits.find((h) => h.id === "late")!;
    expect(late).toMatchObject({ done: 1, possible: 2, pct: 50 });
    expect(r.best?.id).toBe("prayer");
    expect(r.weakest?.id).toBe("late");
    // 2026-11-01 is a Sunday.
    expect(r.weekdays[0]).toEqual({ weekday: 0, pct: 100 });
    expect(r.weekdays[5]).toEqual({ weekday: 5, pct: null });
  });

  it("stops counting an archived habit from its archive day", () => {
    const r = buildReport({
      habits: [habit("a", { archivedDay: "2026-11-03" }), habit("b")],
      values: { "2026-11-01": { a: 1, b: 1 }, "2026-11-03": { b: 1 } },
      from: "2026-11-01",
      to: "2026-11-03",
      today: "2026-11-03",
      historyFrom: "2026-11-01",
    });
    expect(r.days.map((d) => d.possible)).toEqual([2, 2, 1]);
    expect(r.days[2].perfect).toBe(true);
  });

  it("returns empty KPIs when nothing counts", () => {
    const r = buildReport({
      habits: [],
      values: {},
      from: "2026-11-01",
      to: "2026-11-03",
      today: "2026-11-03",
      historyFrom: "2026-11-01",
    });
    expect(r).toMatchObject({ completionPct: null, averageScore: null, perfectDays: 0 });
    expect(r.best).toBeNull();
  });
});
