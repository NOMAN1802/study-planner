import { describe, expect, it } from "vitest";
import {
  cycleMarks,
  cyclesByWeekday,
  cyclesOnDay,
  DAY_START_MIN,
  defaultRoutine,
  formatMinute,
  localNow,
  overlappingSlot,
  parseMinute,
  slotAt,
  slotCycles,
  slotProblem,
  studyCyclesByWeekday,
  studyDayKeyOf,
  studyDayOf,
  studyDaySlots,
  weekCycles,
  type Slot,
} from "@/lib/workstation/routine";

describe("default routine", () => {
  const routine = defaultRoutine();

  it("gives 8 study cycles on office days, 16 on Friday, 64 a week", () => {
    expect(cyclesByWeekday(routine)).toEqual([8, 8, 8, 8, 8, 16, 8]);
    expect(weekCycles(routine)).toBe(64);
  });

  it("puts office 09:00–18:00 on Saturday–Thursday only", () => {
    const office = routine.filter((s) => s.kind === "OFFICE");
    expect(office.map((s) => s.weekday).sort()).toEqual([0, 1, 2, 3, 4, 6]);
    expect(office.every((s) => s.startMin === 540 && s.endMin === 1080)).toBe(true);
  });

  it("has no overlapping slots", () => {
    for (const slot of routine) {
      const others = routine.filter((s) => s !== slot);
      expect(overlappingSlot(others, slot)).toBeNull();
    }
  });

  it("leaves at least 5.5 hours of sleep every night", () => {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const today = routine.filter((s) => s.weekday === weekday);
      const tomorrow = routine.filter((s) => s.weekday === (weekday + 1) % 7);
      const bedtime = Math.max(...today.map((s) => s.endMin));
      const wake = Math.min(...tomorrow.map((s) => s.startMin));
      expect(24 * 60 - bedtime + wake).toBeGreaterThanOrEqual(5.5 * 60);
    }
  });

  it("uses the 04:35–08:35 and 18:45–22:45 study windows on office days", () => {
    const sat = routine.filter((s) => s.weekday === 6 && s.kind === "STUDY");
    expect(sat.map((s) => [formatMinute(s.startMin), formatMinute(s.endMin)])).toEqual([
      ["04:35", "08:35"],
      ["18:45", "22:45"],
    ]);
  });

  it("counts cycles for a calendar day", () => {
    expect(cyclesOnDay(routine, "2026-11-20")).toBe(16); // Friday: 8 + 4 + 4
    expect(cyclesOnDay(routine, "2026-11-21")).toBe(8); // Saturday: 4 + 4
  });
});

describe("slot math", () => {
  const study = (startMin: number, endMin: number): Slot => ({
    weekday: 1,
    startMin,
    endMin,
    kind: "STUDY",
    label: "x",
  });

  it("counts whole 60-minute cycles only for study slots", () => {
    expect(slotCycles(study(0, 179))).toBe(2);
    expect(slotCycles({ ...study(0, 180), kind: "OFFICE" })).toBe(0);
  });

  it("marks 50/10 cycles", () => {
    expect(cycleMarks(study(320, 440))).toEqual([
      { start: 320, breakAt: 370, end: 380 },
      { start: 380, breakAt: 430, end: 440 },
    ]);
  });

  it("detects overlap on the same day, ignoring itself and touching edges", () => {
    const a = { ...study(60, 120), id: "a" };
    expect(overlappingSlot([a], study(119, 200))).toBe(a);
    expect(overlappingSlot([a], study(120, 200))).toBeNull();
    expect(overlappingSlot([a], { ...study(60, 120), weekday: 2 })).toBeNull();
    expect(overlappingSlot([a], { ...a, endMin: 150 })).toBeNull();
  });

  it("validates a slot", () => {
    expect(slotProblem(study(60, 60))).toBe("End must be after start");
    expect(slotProblem({ ...study(0, 60), weekday: 7 })).toBe("Pick a day");
    expect(slotProblem(study(0, 1441))).toBe("Times must be within the day");
    expect(slotProblem(study(0, 1440))).toBeNull();
  });

  it("parses and formats HH:mm", () => {
    expect(parseMinute("05:20")).toBe(320);
    expect(parseMinute("24:00")).toBe(1440);
    expect(parseMinute("24:30")).toBeNull();
    expect(parseMinute("7:00")).toBeNull();
    expect(formatMinute(1380)).toBe("23:00");
  });
});

describe("local now", () => {
  it("resolves the Dhaka day, weekday and minute", () => {
    // 2026-11-19T23:30Z is Friday 05:30 in Dhaka (UTC+6).
    const now = localNow(new Date("2026-11-19T23:30:00Z"), "Asia/Dhaka");
    expect(now).toEqual({ dayKey: "2026-11-20", weekday: 5, minute: 330 });
    const slot = slotAt(defaultRoutine(), now.weekday, now.minute);
    expect(slot?.label).toBe("Morning study");
  });
});

describe("study days start at 18:00", () => {
  const routine = defaultRoutine();

  it("assigns evening moments to the next date", () => {
    expect(studyDayOf("2026-11-20", 17 * 60 + 59)).toBe("2026-11-20");
    expect(studyDayOf("2026-11-20", DAY_START_MIN)).toBe("2026-11-21");
    expect(studyDayOf("2026-11-20", 23 * 60)).toBe("2026-11-21");
  });

  it("knows the current study day in the user's timezone", () => {
    // 2026-11-17 13:30Z = 19:30 in Dhaka (UTC+6): Wednesday's study day.
    expect(localNow(new Date("2026-11-17T13:30:00Z"), "Asia/Dhaka")).toEqual({
      dayKey: "2026-11-18",
      weekday: 3,
      minute: 19 * 60 + 30,
    });
    expect(studyDayKeyOf(new Date("2026-11-17T23:30:00Z"), "Asia/Dhaka")).toBe("2026-11-18");
    expect(studyDayKeyOf(new Date("2026-11-18T12:30:00Z"), "Asia/Dhaka")).toBe("2026-11-19");
  });

  it("puts the evening before first, then the morning", () => {
    const sat = studyDaySlots(routine, 6).map((s) => `${s.weekday}:${s.label}`);
    expect(sat).toEqual([
      "5:Evening study",
      "6:Bath & prep",
      "6:Morning study",
      "6:Commute",
      "6:Office",
    ]);
  });

  it("keeps 8 cycles on office days and 16 on Friday, 64 a week", () => {
    const perDay = studyCyclesByWeekday(routine);
    expect(perDay).toEqual([8, 8, 8, 8, 8, 16, 8]);
    expect(perDay.reduce((a, b) => a + b, 0)).toBe(64);
  });
});
