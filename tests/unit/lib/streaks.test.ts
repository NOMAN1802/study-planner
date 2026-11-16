import { describe, expect, it } from "vitest";
import { periodStart, type Frequency, type PeriodContext, type WeekStart } from "@/lib/dates";
import { computeStreaks, isLogComplete, logProgress, type LogEntry } from "@/lib/streaks";

const at = (s: string) => new Date(s);
const ctx = (
  frequency: Frequency,
  timezone = "UTC",
  weekStartsOn: WeekStart = 1,
): PeriodContext => ({
  frequency,
  timezone,
  weekStartsOn,
});

/** Builds a log in the period containing `instant`. */
function log(c: PeriodContext, instant: string, count = 1, minutes = 0): LogEntry {
  return { periodStart: periodStart(at(instant), c), count, minutes };
}

const noTarget = { targetCount: null, targetMinutes: null };

describe("isLogComplete", () => {
  it("needs one check-in when there is no target", () => {
    expect(isLogComplete(undefined, noTarget)).toBe(false);
    expect(isLogComplete({ count: 0, minutes: 0 }, noTarget)).toBe(false);
    expect(isLogComplete({ count: 1, minutes: 0 }, noTarget)).toBe(true);
  });

  it("requires every target that is set", () => {
    const t = { targetCount: 3, targetMinutes: 20 };
    expect(isLogComplete({ count: 3, minutes: 19 }, t)).toBe(false);
    expect(isLogComplete({ count: 2, minutes: 30 }, t)).toBe(false);
    expect(isLogComplete({ count: 3, minutes: 20 }, t)).toBe(true);
    expect(isLogComplete({ count: 0, minutes: 25 }, { targetCount: null, targetMinutes: 20 })).toBe(
      true,
    );
  });
});

describe("logProgress", () => {
  it("is limited by the least complete target and clamped to 0–1", () => {
    expect(logProgress({ count: 1, minutes: 30 }, { targetCount: 4, targetMinutes: 20 })).toBe(
      0.25,
    );
    expect(logProgress({ count: 10, minutes: 0 }, { targetCount: 4, targetMinutes: null })).toBe(1);
    expect(logProgress(undefined, noTarget)).toBe(0);
  });
});

describe("computeStreaks — daily", () => {
  const c = ctx("DAILY", "UTC");
  const base = { ...noTarget, ctx: c, activeHours: [], createdAt: at("2026-03-01T08:00:00Z") };

  it("counts consecutive days ending yesterday when today is not done yet", () => {
    const logs = ["2026-03-03", "2026-03-04", "2026-03-05"].map((d) => log(c, `${d}T09:00:00Z`));
    const s = computeStreaks({ ...base, logs, now: at("2026-03-06T10:00:00Z") });
    expect(s.currentStreak).toBe(3);
    expect(s.currentPeriodComplete).toBe(false);
  });

  it("includes today once today is complete", () => {
    const logs = ["2026-03-04", "2026-03-05", "2026-03-06"].map((d) => log(c, `${d}T09:00:00Z`));
    const s = computeStreaks({ ...base, logs, now: at("2026-03-06T10:00:00Z") });
    expect(s.currentStreak).toBe(3);
    expect(s.currentPeriodComplete).toBe(true);
  });

  it("resets after a missed day and keeps the best streak", () => {
    const days = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-06"];
    const logs = days.map((d) => log(c, `${d}T09:00:00Z`));
    const s = computeStreaks({ ...base, logs, now: at("2026-03-07T10:00:00Z") });
    expect(s.currentStreak).toBe(1); // 6th only; 5th missed
    expect(s.bestStreak).toBe(4);
  });

  it("is zero when yesterday was missed and today is not done", () => {
    const logs = [log(c, "2026-03-03T09:00:00Z")];
    const s = computeStreaks({ ...base, logs, now: at("2026-03-05T10:00:00Z") });
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(1);
  });

  it("does not count a period whose target was not met", () => {
    const t = { targetCount: 2, targetMinutes: null };
    const logs = [
      log(c, "2026-03-01T09:00:00Z", 2),
      log(c, "2026-03-02T09:00:00Z", 1), // partial
      log(c, "2026-03-03T09:00:00Z", 2),
    ];
    const s = computeStreaks({ ...base, ...t, logs, now: at("2026-03-03T20:00:00Z") });
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(1);
  });

  it("computes completion rate over elapsed days, excluding an unfinished today", () => {
    // Created Mar 1; now Mar 5 (unfinished). Elapsed: Mar 1–4 = 4 days, 3 complete.
    const logs = ["2026-03-01", "2026-03-02", "2026-03-04"].map((d) => log(c, `${d}T09:00:00Z`));
    const s = computeStreaks({ ...base, logs, now: at("2026-03-05T10:00:00Z") });
    expect(s.elapsedPeriods).toBe(4);
    expect(s.completedPeriods).toBe(3);
    expect(s.completionRate).toBeCloseTo(0.75);
  });

  it("returns zeros for a brand-new habit", () => {
    const s = computeStreaks({ ...base, logs: [], now: at("2026-03-01T09:00:00Z") });
    expect(s).toMatchObject({
      currentStreak: 0,
      bestStreak: 0,
      completionRate: 0,
      elapsedPeriods: 0,
    });
  });

  it("crosses a month boundary without a gap", () => {
    const logs = ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"].map((d) =>
      log(c, `${d}T12:00:00Z`),
    );
    const s = computeStreaks({
      ...base,
      createdAt: at("2026-02-27T00:00:00Z"),
      logs,
      now: at("2026-03-02T23:00:00Z"),
    });
    expect(s.currentStreak).toBe(4);
  });

  it("uses local days: two check-ins on the same UTC date can be different local days", () => {
    const dhaka = ctx("DAILY", "Asia/Dhaka");
    // 2026-03-02 17:00 UTC = Mar 2 23:00 Dhaka; 2026-03-02 19:00 UTC = Mar 3 01:00 Dhaka.
    const logs = [log(dhaka, "2026-03-02T17:00:00Z"), log(dhaka, "2026-03-02T19:00:00Z")];
    const s = computeStreaks({
      ...base,
      ctx: dhaka,
      createdAt: at("2026-03-02T00:00:00Z"),
      logs,
      now: at("2026-03-03T10:00:00Z"), // Mar 3 16:00 Dhaka
    });
    expect(s.currentStreak).toBe(2);
    // In UTC the same two check-in instants fall on a single day (Mar 2), and
    // Mar 3 (today) is not done yet → streak of 1.
    const utc = computeStreaks({
      ...base,
      createdAt: at("2026-03-02T00:00:00Z"),
      logs: [log(c, "2026-03-02T17:00:00Z"), log(c, "2026-03-02T19:00:00Z")],
      now: at("2026-03-03T10:00:00Z"),
    });
    expect(utc.currentStreak).toBe(1);
    expect(utc.completedPeriods).toBe(1);
  });

  it("counts across the DST spring-forward day", () => {
    const ny = ctx("DAILY", "America/New_York");
    const logs = ["2026-03-07T15:00:00Z", "2026-03-08T15:00:00Z", "2026-03-09T15:00:00Z"].map((i) =>
      log(ny, i),
    );
    const s = computeStreaks({
      ...base,
      ctx: ny,
      createdAt: at("2026-03-07T06:00:00Z"),
      logs,
      now: at("2026-03-09T20:00:00Z"),
    });
    expect(s.currentStreak).toBe(3);
  });

  it("starts counting at the first log if it predates creation", () => {
    const logs = [log(c, "2026-02-27T09:00:00Z"), log(c, "2026-02-28T09:00:00Z")];
    const s = computeStreaks({ ...base, logs, now: at("2026-03-01T10:00:00Z") });
    expect(s.currentStreak).toBe(2);
  });

  it("ignores logs in the future", () => {
    const logs = [log(c, "2026-03-10T09:00:00Z")];
    const s = computeStreaks({ ...base, logs, now: at("2026-03-02T10:00:00Z") });
    expect(s.bestStreak).toBe(0);
  });
});

describe("computeStreaks — weekly", () => {
  const monday = ctx("WEEKLY", "UTC", 1);
  const sunday = ctx("WEEKLY", "UTC", 0);
  const base = { ...noTarget, activeHours: [], createdAt: at("2026-02-02T00:00:00Z") };

  it("counts consecutive weeks", () => {
    // Weeks (Mon start): Feb 2, Feb 9, Feb 16. Now in week of Feb 23, not done.
    const logs = ["2026-02-04", "2026-02-15", "2026-02-16"].map((d) =>
      log(monday, `${d}T10:00:00Z`),
    );
    const s = computeStreaks({ ...base, ctx: monday, logs, now: at("2026-02-24T10:00:00Z") });
    expect(s.currentStreak).toBe(3);
  });

  it("depends on week start: a Sunday check-in moves between weeks", () => {
    // Check-ins: Wed Feb 4 and Sun Feb 15.
    const instants = ["2026-02-04T10:00:00Z", "2026-02-15T10:00:00Z"];
    // Monday-start: Feb 2 week and Feb 9 week → consecutive.
    const mon = computeStreaks({
      ...base,
      ctx: monday,
      logs: instants.map((i) => log(monday, i)),
      now: at("2026-02-17T10:00:00Z"),
    });
    expect(mon.currentStreak).toBe(2);
    // Sunday-start: Feb 1 week and Feb 15 week → gap (Feb 8 week empty).
    const sun = computeStreaks({
      ...base,
      ctx: sunday,
      logs: instants.map((i) => log(sunday, i)),
      now: at("2026-02-17T10:00:00Z"),
    });
    expect(sun.currentStreak).toBe(1);
    expect(sun.bestStreak).toBe(1);
  });

  it("applies the weekly target to the sum of the week", () => {
    const t = { targetCount: 3, targetMinutes: null };
    const logs = [log(monday, "2026-02-02T10:00:00Z", 3), log(monday, "2026-02-09T10:00:00Z", 2)];
    const s = computeStreaks({ ...base, ...t, ctx: monday, logs, now: at("2026-02-17T10:00:00Z") });
    expect(s.bestStreak).toBe(1);
    expect(s.currentStreak).toBe(0);
  });

  it("crosses a year boundary", () => {
    const logs = ["2025-12-24", "2025-12-31", "2026-01-07"].map((d) =>
      log(monday, `${d}T10:00:00Z`),
    );
    const s = computeStreaks({
      ...base,
      ctx: monday,
      createdAt: at("2025-12-22T00:00:00Z"),
      logs,
      now: at("2026-01-08T10:00:00Z"),
    });
    expect(s.currentStreak).toBe(3);
  });
});

describe("computeStreaks — monthly", () => {
  const c = ctx("MONTHLY", "UTC");
  const base = { ...noTarget, ctx: c, activeHours: [], createdAt: at("2026-01-10T00:00:00Z") };

  it("counts consecutive months and ignores the unfinished current month", () => {
    const logs = ["2026-01-31", "2026-02-01", "2026-03-15"].map((d) => log(c, `${d}T10:00:00Z`));
    const s = computeStreaks({ ...base, logs, now: at("2026-04-02T00:00:00Z") });
    expect(s.currentStreak).toBe(3);
    expect(s.completionRate).toBe(1);
  });

  it("breaks on a missed month", () => {
    const logs = ["2026-01-05", "2026-03-05"].map((d) => log(c, `${d}T10:00:00Z`));
    const s = computeStreaks({
      ...base,
      createdAt: at("2026-01-01T00:00:00Z"),
      logs,
      now: at("2026-03-20T00:00:00Z"),
    });
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(1);
    expect(s.completionRate).toBeCloseTo(2 / 3);
  });

  it("uses the local month boundary", () => {
    const dhaka = ctx("MONTHLY", "Asia/Dhaka");
    // Jan 31 20:00 UTC = Feb 1 02:00 Dhaka → February in Dhaka.
    const logs = [log(dhaka, "2026-01-15T10:00:00Z"), log(dhaka, "2026-01-31T20:00:00Z")];
    const s = computeStreaks({ ...base, ctx: dhaka, logs, now: at("2026-02-10T00:00:00Z") });
    expect(s.currentStreak).toBe(2);
    expect(s.currentPeriodComplete).toBe(true);
  });
});

describe("computeStreaks — hourly", () => {
  const c = ctx("HOURLY", "UTC");
  const base = { ...noTarget, ctx: c, createdAt: at("2026-03-01T00:00:00Z") };

  it("skips inactive hours without breaking the streak", () => {
    // Active 09–10 and 17. Logs 09, 10, 17 → hours 11–16 inactive.
    const logs = ["09", "10", "17"].map((h) => log(c, `2026-03-01T${h}:15:00Z`));
    const s = computeStreaks({
      ...base,
      activeHours: [9, 10, 17],
      logs,
      now: at("2026-03-01T17:30:00Z"),
    });
    expect(s.currentStreak).toBe(3);
    expect(s.elapsedPeriods).toBe(3);
  });

  it("crosses midnight into the next day's active hours", () => {
    const logs = [log(c, "2026-03-01T22:10:00Z"), log(c, "2026-03-02T08:10:00Z")];
    const s = computeStreaks({
      ...base,
      activeHours: [8, 22],
      createdAt: at("2026-03-01T22:00:00Z"),
      logs,
      now: at("2026-03-02T09:00:00Z"),
    });
    expect(s.currentStreak).toBe(2);
  });

  it("with no active hours set, every hour counts", () => {
    const logs = [log(c, "2026-03-01T01:10:00Z"), log(c, "2026-03-01T03:10:00Z")];
    const s = computeStreaks({
      ...base,
      activeHours: [],
      createdAt: at("2026-03-01T01:00:00Z"),
      logs,
      now: at("2026-03-01T03:20:00Z"),
    });
    expect(s.currentStreak).toBe(1); // 02:00 missed
    expect(s.bestStreak).toBe(1);
  });
});
