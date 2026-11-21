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

  it("gives 7 study cycles on office days, 15 on Friday, 57 a week", () => {
    expect(cyclesByWeekday(routine)).toEqual([7, 7, 7, 7, 7, 15, 7]);
    expect(weekCycles(routine)).toBe(57);
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

  it("leaves 6 hours of sleep every night, 23:00–05:00", () => {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const today = routine.filter((s) => s.weekday === weekday);
      const tomorrow = routine.filter((s) => s.weekday === (weekday + 1) % 7);
      const bedtime = Math.max(...today.map((s) => s.endMin));
      const wake = Math.min(...tomorrow.map((s) => s.startMin));
      expect(formatMinute(bedtime)).toBe("23:00");
      expect(formatMinute(wake)).toBe("05:00");
      expect(24 * 60 - bedtime + wake).toBeGreaterThanOrEqual(6 * 60);
    }
  });

  it("uses the 05:30–08:30 and 18:50–22:50 study windows on office days", () => {
    const sat = routine.filter((s) => s.weekday === 6 && s.kind === "STUDY");
    expect(sat.map((s) => [formatMinute(s.startMin), formatMinute(s.endMin)])).toEqual([
      ["05:30", "08:30"],
      ["18:50", "22:50"],
    ]);
  });

  it("counts cycles for a calendar day", () => {
    expect(cyclesOnDay(routine, "2026-11-20")).toBe(15); // Friday: 7 + 4 + 4
    expect(cyclesOnDay(routine, "2026-11-21")).toBe(7); // Saturday: 3 + 4
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

describe("study days follow the calendar from the morning", () => {
  const routine = defaultRoutine();

  it("keeps the evening on its own date; only after midnight counts for the day before", () => {
    expect(studyDayOf("2026-11-20", 5 * 60)).toBe("2026-11-20");
    expect(studyDayOf("2026-11-20", 22 * 60)).toBe("2026-11-20");
    expect(studyDayOf("2026-11-20", 23 * 60 + 59)).toBe("2026-11-20");
    expect(studyDayOf("2026-11-21", 30)).toBe("2026-11-20");
    expect(studyDayOf("2026-11-21", DAY_START_MIN)).toBe("2026-11-21");
  });

  it("knows the current study day in the user's timezone", () => {
    // 2026-11-17 13:30Z = Tuesday 19:30 in Dhaka (UTC+6): still Tuesday.
    expect(localNow(new Date("2026-11-17T13:30:00Z"), "Asia/Dhaka")).toEqual({
      dayKey: "2026-11-17",
      weekday: 2,
      minute: 19 * 60 + 30,
    });
    // 2026-11-17 18:30Z = Wednesday 00:30 in Dhaka: Tuesday's study day.
    expect(studyDayKeyOf(new Date("2026-11-17T18:30:00Z"), "Asia/Dhaka")).toBe("2026-11-17");
    // 2026-11-17 23:30Z = Wednesday 05:30 in Dhaka.
    expect(studyDayKeyOf(new Date("2026-11-17T23:30:00Z"), "Asia/Dhaka")).toBe("2026-11-18");
  });

  it("lists the day's own slots, morning to night", () => {
    const sat = studyDaySlots(routine, 6).map((s) => `${s.weekday}:${s.label}`);
    expect(sat).toEqual([
      "6:Bath & prep",
      "6:Morning study",
      "6:Commute",
      "6:Office",
      "6:Commute & rest",
      "6:Evening study",
      "6:Get ready for bed",
    ]);
  });

  it("adds the next weekday's after-midnight slots to the day", () => {
    const late: Slot = { weekday: 0, startMin: 30, endMin: 90, kind: "STUDY", label: "Late" };
    const sat = studyDaySlots([...routine, late], 6);
    expect(sat.at(-1)?.label).toBe("Late");
    expect(studyDaySlots([...routine, late], 0).some((s) => s.label === "Late")).toBe(false);
  });

  it("uses Friday's routine on a holiday", () => {
    expect(studyCyclesByWeekday(routine, true)).toEqual([15, 15, 15, 15, 15, 15, 15]);
  });

  it("keeps 7 cycles on office days and 15 on Friday, 57 a week", () => {
    const perDay = studyCyclesByWeekday(routine);
    expect(perDay).toEqual([7, 7, 7, 7, 7, 15, 7]);
    expect(perDay.reduce((a, b) => a + b, 0)).toBe(57);
  });
});
