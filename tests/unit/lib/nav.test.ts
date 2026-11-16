import { describe, expect, it } from "vitest";
import { pageTitle } from "@/lib/nav";

describe("pageTitle", () => {
  it("matches exact and nested routes", () => {
    expect(pageTitle("/dashboard")).toBe("Dashboard");
    expect(pageTitle("/habits/abc")).toBe("Habits");
  });

  it("falls back to the app name", () => {
    expect(pageTitle("/unknown")).toBe("Habit Tracker");
  });
});

import { targetSummary } from "@/lib/habit-format";

describe("targetSummary", () => {
  it("lists frequency and any targets", () => {
    expect(targetSummary({ frequency: "DAILY", targetCount: null, targetMinutes: null })).toBe(
      "Daily",
    );
    expect(targetSummary({ frequency: "WEEKLY", targetCount: 3, targetMinutes: 45 })).toBe(
      "Weekly · 3× · 45 min",
    );
  });
});
