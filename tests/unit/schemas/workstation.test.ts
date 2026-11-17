import { describe, expect, it } from "vitest";
import {
  estimateSchema,
  examSchema,
  firstErrors,
  parseTab,
  planLengthSchema,
  setupSchema,
  slotSchema,
} from "@/schemas/workstation";

describe("setupSchema", () => {
  it("accepts a start date and phase lengths", () => {
    expect(
      setupSchema.parse({ startDay: "2026-11-17", learningDays: "70", revisionDays: "20" }),
    ).toEqual({ startDay: "2026-11-17", learningDays: 70, revisionDays: 20 });
  });
  it("rejects bad dates and lengths", () => {
    const r = setupSchema.safeParse({
      startDay: "2026-02-30",
      learningDays: "3",
      revisionDays: "-1",
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(firstErrors(r.error)).toEqual({
        startDay: "Pick a date",
        learningDays: "Learning days must be at least 7",
        revisionDays: "Revision days must be at least 0",
      });
  });
});

describe("planLengthSchema holidays", () => {
  const base = { startDay: "2026-11-18", learningDays: "80", revisionDays: "20" };
  it("parses a comma list into sorted unique dates", () => {
    expect(
      planLengthSchema.parse({ ...base, holidays: "2026-12-25, 2026-12-16,2026-12-25" }).holidays,
    ).toEqual(["2026-12-16", "2026-12-25"]);
  });
  it("accepts no holidays", () => {
    expect(planLengthSchema.parse({ ...base, holidays: "" }).holidays).toEqual([]);
    expect(planLengthSchema.parse(base).holidays).toEqual([]);
  });
  it("rejects a bad date", () => {
    const r = planLengthSchema.safeParse({ ...base, holidays: "2026-12-16,2026-02-30" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstErrors(r.error)).toEqual({ holidays: "Pick valid dates" });
  });
});

describe("slotSchema", () => {
  it("parses HH:mm into minutes", () => {
    expect(
      slotSchema.parse({
        weekday: "6",
        start: "05:20",
        end: "08:20",
        kind: "STUDY",
        label: " Morning ",
      }),
    ).toEqual({ weekday: 6, start: 320, end: 500, kind: "STUDY", label: "Morning" });
  });
  it("rejects end before start and bad times", () => {
    const a = slotSchema.safeParse({
      weekday: 1,
      start: "09:00",
      end: "08:00",
      kind: "OFFICE",
      label: "x",
    });
    expect(a.success).toBe(false);
    if (!a.success) expect(firstErrors(a.error)).toEqual({ end: "End must be after start" });
    const b = slotSchema.safeParse({
      weekday: 1,
      start: "9",
      end: "10:00",
      kind: "NAP",
      label: "",
    });
    expect(b.success).toBe(false);
    if (!b.success)
      expect(Object.keys(firstErrors(b.error)).sort()).toEqual(["kind", "label", "start"]);
  });
});

describe("examSchema", () => {
  const base = {
    kind: "WEEKLY",
    day: "2026-11-27",
    subjectId: "",
    score: "42",
    total: "50",
    note: "",
  };
  it("accepts a weekly exam without a subject", () => {
    expect(examSchema.parse(base)).toEqual({
      kind: "WEEKLY",
      day: "2026-11-27",
      subjectId: null,
      score: 42,
      total: 50,
      note: null,
    });
  });
  it("requires a subject for a subject final and score ≤ total", () => {
    const r = examSchema.safeParse({ ...base, kind: "SUBJECT_FINAL", score: "60" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(firstErrors(r.error)).toEqual({
        subjectId: "Pick the subject",
        score: "Score can't be more than the total",
      });
  });
});

describe("misc", () => {
  it("bounds the topic estimate", () => {
    expect(estimateSchema.safeParse("0").success).toBe(false);
    expect(estimateSchema.parse("3")).toBe(3);
  });
  it("falls back to the today tab", () => {
    expect(parseTab("plan")).toBe("plan");
    expect(parseTab(["exams"])).toBe("exams");
    expect(parseTab("nope")).toBe("today");
    expect(parseTab(undefined)).toBe("today");
  });
});
