import { describe, expect, it } from "vitest";
import { pomodoroConfigErrors, pomodoroConfigSchema } from "@/schemas/pomodoro";

describe("pomodoroConfigSchema", () => {
  it("parses form values, with a checkbox for auto-start", () => {
    expect(
      pomodoroConfigSchema.parse({
        focusMinutes: "50",
        shortBreakMinutes: "10",
        longBreakMinutes: "20",
        cyclesBeforeLongBreak: "3",
        autoStartNext: "on",
      }),
    ).toEqual({
      focusMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 20,
      cyclesBeforeLongBreak: 3,
      autoStartNext: true,
    });
    expect(
      pomodoroConfigSchema.parse({
        focusMinutes: 1,
        shortBreakMinutes: 1,
        longBreakMinutes: 1,
        cyclesBeforeLongBreak: 1,
        autoStartNext: null,
      }).autoStartNext,
    ).toBe(false);
  });

  it("rejects out-of-range values", () => {
    const r = pomodoroConfigSchema.safeParse({
      focusMinutes: "0",
      shortBreakMinutes: "61",
      longBreakMinutes: "1.5",
      cyclesBeforeLongBreak: "13",
    });
    expect(r.success).toBe(false);
    expect(pomodoroConfigErrors(r.error!)).toEqual({
      focusMinutes: "Focus must be at least 1",
      shortBreakMinutes: "Short break must be at most 60",
      longBreakMinutes: "Long break must be a whole number",
      cyclesBeforeLongBreak: "Cycles must be at most 12",
    });
  });
});
