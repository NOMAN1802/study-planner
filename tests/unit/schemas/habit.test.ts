import { describe, expect, it } from "vitest";
import { checkInSchema, habitFieldErrors, habitSchema } from "@/schemas/habit";

const valid = {
  name: "Read",
  note: "",
  color: "#0f766e",
  icon: "book-open",
  frequency: "DAILY",
  targetCount: "",
  targetMinutes: "",
  activeHours: [],
};

describe("habitSchema", () => {
  it("parses a minimal habit, turning empty strings into nulls", () => {
    const r = habitSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({
        name: "Read",
        note: null,
        targetCount: null,
        targetMinutes: null,
        activeHours: [],
      });
    }
  });

  it("coerces targets and rejects non-integers and zero", () => {
    expect(habitSchema.safeParse({ ...valid, targetCount: "3" }).data?.targetCount).toBe(3);
    const r = habitSchema.safeParse({ ...valid, targetCount: "0", targetMinutes: "1.5" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(habitFieldErrors(r.error)).toEqual({
        targetCount: "Target count must be at least 1",
        targetMinutes: "Target minutes must be a whole number",
      });
    }
  });

  it("caps target minutes by period length", () => {
    const r = habitSchema.safeParse({ ...valid, frequency: "HOURLY", targetMinutes: "61" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(habitFieldErrors(r.error).targetMinutes).toBe(
        "Target minutes can't exceed 60 per hour",
      );
    }
    expect(
      habitSchema.safeParse({ ...valid, frequency: "WEEKLY", targetMinutes: "600" }).success,
    ).toBe(true);
  });

  it("keeps sorted unique active hours for hourly habits only", () => {
    const hourly = habitSchema.safeParse({
      ...valid,
      frequency: "HOURLY",
      activeHours: ["17", "9", "9"],
    });
    expect(hourly.data?.activeHours).toEqual([9, 17]);
    const daily = habitSchema.safeParse({ ...valid, activeHours: ["9"] });
    expect(daily.data?.activeHours).toEqual([]);
  });

  it("rejects out-of-range hours, unknown colours and icons", () => {
    const r = habitSchema.safeParse({
      ...valid,
      frequency: "HOURLY",
      activeHours: ["24"],
      color: "#ffffff",
      icon: "rocket",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = habitFieldErrors(r.error);
      expect(Object.keys(e).sort()).toEqual(["activeHours", "color", "icon"]);
    }
  });

  it("requires a trimmed name of at most 60 characters", () => {
    expect(habitFieldErrors(habitSchema.safeParse({ ...valid, name: "   " }).error!)).toEqual({
      name: "Name is required",
    });
    expect(habitSchema.safeParse({ ...valid, name: "x".repeat(61) }).success).toBe(false);
  });
});

describe("checkInSchema", () => {
  it("accepts zero counts and trims the note", () => {
    const r = checkInSchema.safeParse({
      habitId: "3f6c2d0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f",
      count: "0",
      minutes: "15",
      note: "  ok  ",
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ count: 0, minutes: 15, note: "ok" });
  });

  it("rejects negative values and bad ids", () => {
    expect(checkInSchema.safeParse({ habitId: "nope", count: 1, minutes: 0 }).success).toBe(false);
    expect(
      checkInSchema.safeParse({
        habitId: "3f6c2d0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f",
        count: -1,
        minutes: 0,
      }).success,
    ).toBe(false);
  });
});
