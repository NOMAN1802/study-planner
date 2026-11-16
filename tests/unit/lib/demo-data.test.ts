import { describe, expect, it } from "vitest";
import { isActivePeriod, periodKey, periodStart, type PeriodContext } from "@/lib/dates";
import { HABIT_COLOR_VALUES, HABIT_ICON_NAMES } from "@/lib/habit-options";
import { computeStreaks } from "@/lib/streaks";
import { buildDemoData } from "../../../prisma/demo-data";

const zone = { timezone: "Asia/Dhaka", weekStartsOn: 1 as const };
const now = new Date("2026-11-15T10:00:00Z"); // Sun 15 Nov 16:00 Dhaka
const data = buildDemoData(now, zone);
const ctxOf = (frequency: PeriodContext["frequency"]): PeriodContext => ({ frequency, ...zone });

describe("buildDemoData", () => {
  it("is deterministic", () => {
    expect(buildDemoData(now, zone)).toEqual(data);
  });

  it("covers every frequency with valid colours and icons", () => {
    expect(new Set(data.habits.map((h) => h.frequency))).toEqual(
      new Set(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"]),
    );
    for (const h of data.habits) {
      expect(HABIT_COLOR_VALUES).toContain(h.color);
      expect(HABIT_ICON_NAMES).toContain(h.icon);
      expect(h.targetCount ?? h.targetMinutes).toBeGreaterThan(0);
    }
  });

  it("writes one canonical, past, active log per period", () => {
    for (const h of data.habits) {
      const ctx = ctxOf(h.frequency);
      const keys = h.logs.map((l) => periodKey(l.periodStart));
      expect(new Set(keys).size).toBe(keys.length);
      for (const log of h.logs) {
        expect(periodStart(log.periodStart, ctx)).toEqual(log.periodStart);
        expect(log.periodStart.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(log.periodStart.getTime()).toBeGreaterThanOrEqual(
          periodStart(h.createdAt, ctx).getTime(),
        );
        expect(isActivePeriod(log.periodStart, ctx, h.activeHours)).toBe(true);
        expect(log.count + log.minutes).toBeGreaterThan(0);
      }
    }
  });

  it("leaves a live streak on the first habit with today still to do", () => {
    const read = data.habits[0];
    const stats = computeStreaks({
      targetCount: read.targetCount,
      targetMinutes: read.targetMinutes,
      ctx: ctxOf(read.frequency),
      activeHours: read.activeHours,
      createdAt: read.createdAt,
      logs: read.logs,
      now,
    });
    expect(stats.currentStreak).toBeGreaterThanOrEqual(3);
    expect(stats.currentPeriodComplete).toBe(false);
    expect(stats.bestStreak).toBeGreaterThanOrEqual(stats.currentStreak);
  });

  it("keeps task time consistent with its focus sessions", () => {
    expect(data.tasks.length).toBeGreaterThanOrEqual(5);
    const habitKeys = new Set(data.habits.map((h) => h.key));
    for (const t of data.tasks) {
      const focused = t.sessions
        .filter((s) => s.type === "FOCUS" && s.completed)
        .reduce((sum, s) => sum + s.plannedMinutes, 0);
      expect(t.actualMinutes).toBe(focused);
      expect(t.completedAt !== null).toBe(t.status === "DONE");
      if (t.habitKey) expect(habitKeys).toContain(t.habitKey);
      for (const s of t.sessions) {
        expect(s.endedAt.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(s.endedAt.getTime() - s.startedAt.getTime()).toBe(s.plannedMinutes * 60_000);
      }
    }
    expect(data.tasks.some((t) => t.sessions.length > 0)).toBe(true);
    expect(data.tasks.some((t) => t.status !== "DONE" && t.dueAt && t.dueAt < now)).toBe(true);
  });

  it("plans valid time blocks that point at seeded items", () => {
    const keys = new Set([...data.habits.map((h) => h.key), ...data.tasks.map((t) => t.key)]);
    expect(data.blocks.length).toBeGreaterThan(0);
    for (const b of data.blocks) {
      const minutes = (b.endAt.getTime() - b.startAt.getTime()) / 60_000;
      expect(minutes).toBeGreaterThanOrEqual(15);
      expect(minutes).toBeLessThanOrEqual(8 * 60);
      expect(b.taskKey && b.habitKey).toBeFalsy();
      const ref = b.taskKey ?? b.habitKey;
      if (ref) expect(keys).toContain(ref);
    }
  });
});
