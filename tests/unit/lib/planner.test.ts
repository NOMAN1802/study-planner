import { describe, expect, it } from "vitest";
import {
  MINUTE_MS,
  addDays,
  blockAt,
  conflictingIds,
  dayInfo,
  dayKeyOf,
  defaultBlockMinutes,
  isDayKey,
  layoutLanes,
  monthWeeks,
  moveBlock,
  moveToDay,
  overlaps,
  parsePlannerParams,
  resizeBlock,
  segmentInDay,
  shiftKey,
  snapMinutes,
  viewDayKeys,
} from "@/lib/planner";

const H = 60 * MINUTE_MS;
const at = (s: string) => new Date(s).getTime();

describe("day keys", () => {
  it("validates real calendar dates", () => {
    expect(isDayKey("2026-02-28")).toBe(true);
    expect(isDayKey("2026-02-29")).toBe(false);
    expect(isDayKey("2028-02-29")).toBe(true);
    expect(isDayKey("2026-2-1")).toBe(false);
    expect(isDayKey(undefined)).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("uses the local date of an instant", () => {
    // 20:00 UTC on 15 Nov is already 16 Nov in Dhaka.
    expect(dayKeyOf(at("2026-11-15T20:00:00Z"), "Asia/Dhaka")).toBe("2026-11-16");
    expect(dayKeyOf(at("2026-11-15T20:00:00Z"), "UTC")).toBe("2026-11-15");
  });

  it("shifts by view", () => {
    expect(shiftKey("day", "2026-11-15", 1)).toBe("2026-11-16");
    expect(shiftKey("week", "2026-11-15", -1)).toBe("2026-11-08");
    expect(shiftKey("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftKey("month", "2026-01-15", -1)).toBe("2025-12-01");
  });

  it("parses URL params with safe fallbacks", () => {
    const now = new Date("2026-11-15T20:00:00Z");
    expect(parsePlannerParams({}, "Asia/Dhaka", now)).toEqual({ view: "week", date: "2026-11-16" });
    expect(parsePlannerParams({ view: "month", date: "2026-02-30" }, "UTC", now)).toEqual({
      view: "month",
      date: "2026-11-15",
    });
    expect(parsePlannerParams({ view: "day", date: "2030-01-15" }, "UTC", now)).toEqual({
      view: "day",
      date: "2030-01-15",
    });
  });
});

describe("dayInfo", () => {
  it("covers local midnight to midnight with 24 hour marks", () => {
    const d = dayInfo("2026-11-16", "Asia/Dhaka");
    expect(new Date(d.start).toISOString()).toBe("2026-11-15T18:00:00.000Z");
    expect(d.end - d.start).toBe(24 * H);
    expect(d.hours).toHaveLength(24);
    expect(d.hours[9]).toBe(d.start + 9 * H);
  });

  it("has 23 hours on spring-forward and 25 on fall-back days", () => {
    expect(dayInfo("2026-03-08", "America/New_York").hours).toHaveLength(23);
    const fall = dayInfo("2026-11-01", "America/New_York");
    expect(fall.hours).toHaveLength(25);
    expect(fall.end - fall.start).toBe(25 * H);
  });
});

describe("view ranges", () => {
  it("week view starts on the user's week start", () => {
    // 2026-11-15 is a Sunday.
    expect(viewDayKeys("week", "2026-11-15", 1)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(viewDayKeys("week", "2026-11-15", 0)[0]).toBe("2026-11-15");
    expect(viewDayKeys("day", "2026-11-15", 1)).toEqual(["2026-11-15"]);
  });

  it("month view is whole weeks covering the month", () => {
    const weeks = monthWeeks("2026-11-20", 1);
    expect(weeks[0][0]).toBe("2026-10-26"); // Monday before 1 Nov (a Sunday)
    expect(weeks.at(-1)?.at(-1)).toBe("2026-12-06");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat()).toContain("2026-11-30");
    // February 2027 starts on Monday and has exactly 4 weeks.
    expect(monthWeeks("2027-02-10", 1)).toHaveLength(4);
  });
});

describe("slot math", () => {
  const day = dayInfo("2030-01-15", "UTC");

  it("snaps to 15 minutes", () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(-8)).toBe(-15);
    expect(snapMinutes(612)).toBe(615);
  });

  it("creates a block at a snapped offset, kept inside the day", () => {
    const b = blockAt(day, 10 * 60 + 7, 90);
    expect(b.start - day.start).toBe(10 * H);
    expect(b.end - b.start).toBe(90 * MINUTE_MS);
    const late = blockAt(day, 23 * 60 + 50, 60);
    expect(late.end).toBe(day.end);
    expect(late.end - late.start).toBe(60 * MINUTE_MS);
    expect(blockAt(day, 0, 5).end - day.start).toBe(15 * MINUTE_MS);
  });

  it("moves by snapped minutes and keeps duration", () => {
    const b = { start: day.start + 10 * H, end: day.start + 11 * H };
    expect(moveBlock(b, 37)).toEqual({
      start: b.start + 30 * MINUTE_MS,
      end: b.end + 30 * MINUTE_MS,
    });
    expect(moveBlock(b, -60)).toEqual({ start: b.start - H, end: b.end - H });
  });

  it("resizes with a 15-minute minimum and 24-hour maximum", () => {
    const b = { start: day.start + 10 * H, end: day.start + 11 * H };
    expect(resizeBlock(b, 30).end).toBe(b.end + 30 * MINUTE_MS);
    expect(resizeBlock(b, -120).end).toBe(b.start + 15 * MINUTE_MS);
    expect(resizeBlock(b, 48 * 60).end).toBe(b.start + 24 * H);
  });

  it("moves to another day keeping the time of day", () => {
    const tue = dayInfo("2030-01-15", "Asia/Dhaka");
    const thu = dayInfo("2030-01-17", "Asia/Dhaka");
    const b = { start: tue.start + 9 * H, end: tue.start + 10 * H };
    expect(moveToDay(b, tue.start, thu.start)).toEqual({
      start: thu.start + 9 * H,
      end: thu.start + 10 * H,
    });
  });

  it("clips a block to the part inside a day", () => {
    const overnight = { start: day.start - 2 * H, end: day.start + H };
    expect(segmentInDay(overnight, day)).toEqual({ top: 0, height: 60 });
    expect(segmentInDay({ start: day.end, end: day.end + H }, day)).toBeNull();
  });

  it("default durations use remaining task time or habit target", () => {
    expect(defaultBlockMinutes({ kind: "task", targetMinutes: 90, actualMinutes: 25 })).toBe(60); // 65 → 60
    expect(defaultBlockMinutes({ kind: "task", targetMinutes: null })).toBe(60);
    expect(defaultBlockMinutes({ kind: "task", targetMinutes: 30, actualMinutes: 40 })).toBe(60);
    expect(defaultBlockMinutes({ kind: "habit", targetMinutes: null })).toBe(30);
    expect(defaultBlockMinutes({ kind: "habit", targetMinutes: 600 })).toBe(240);
  });
});

describe("overlap", () => {
  const b = (id: string, from: number, to: number) => ({ id, start: from * H, end: to * H });

  it("treats touching blocks as not overlapping", () => {
    expect(overlaps(b("a", 9, 10), b("b", 10, 11))).toBe(false);
    expect(overlaps(b("a", 9, 10.5), b("b", 10, 11))).toBe(true);
  });

  it("finds conflicting ids", () => {
    const blocks = [
      b("a", 9, 10),
      b("b", 9.5, 11),
      b("c", 11, 12),
      b("d", 13, 14),
      b("e", 13, 13.5),
    ];
    expect([...conflictingIds(blocks)].sort()).toEqual(["a", "b", "d", "e"]);
  });

  it("lays out overlapping blocks in lanes; separate clusters are full width", () => {
    const lanes = layoutLanes([b("a", 9, 11), b("b", 9.5, 10), b("c", 10, 12), b("d", 13, 14)]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get("c")).toEqual({ lane: 1, lanes: 2 }); // reuses b's lane once b ends
    expect(lanes.get("d")).toEqual({ lane: 0, lanes: 1 });
  });

  it("uses three lanes when three blocks overlap at once", () => {
    const lanes = layoutLanes([b("a", 9, 12), b("b", 9, 12), b("c", 10, 11)]);
    expect(new Set([...lanes.values()].map((l) => l.lane))).toEqual(new Set([0, 1, 2]));
    expect([...lanes.values()].every((l) => l.lanes === 3)).toBe(true);
  });
});
