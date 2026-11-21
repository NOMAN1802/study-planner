import { describe, expect, it } from "vitest";
import { NAV_ITEMS, activeChild, pageTitle } from "@/lib/nav";

describe("pageTitle", () => {
  it("matches exact and nested routes", () => {
    expect(pageTitle("/dashboard")).toBe("Dashboard");
    expect(pageTitle("/habits/abc")).toBe("Habits");
  });

  it("falls back to the app name", () => {
    expect(pageTitle("/unknown")).toBe("Habit Tracker");
  });
});

describe("activeChild", () => {
  const station = NAV_ITEMS.find((i) => i.href === "/work-station")!;
  const label = (path: string) => activeChild(station, path)?.label;

  it("matches Today only on the Study Station root", () => {
    expect(label("/work-station")).toBe("Today");
    expect(label("/work-station/plan")).toBe("Plan");
    expect(label("/work-station/subjects")).toBe("Subjects");
    expect(label("/work-station/archived")).toBe("Archived");
  });

  it("puts exam sittings and practice under Exams", () => {
    expect(label("/work-station/exam/123")).toBe("Exams");
    expect(label("/work-station/practice")).toBe("Exams");
  });

  it("has no children for plain items", () => {
    expect(activeChild(NAV_ITEMS[0], "/dashboard")).toBeUndefined();
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
