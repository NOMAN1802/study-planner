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

  it("lists the habit pages, with new and edit pages under All habits", () => {
    const habits = NAV_ITEMS.find((i) => i.href === "/habits")!;
    const at = (path: string) => activeChild(habits, path)?.label;
    expect(at("/habits")).toBe("All habits");
    expect(at("/habits/daily")).toBe("Daily");
    expect(at("/habits/tracker")).toBe("Tracker");
    expect(at("/habits/report")).toBe("Report");
    expect(at("/habits/new")).toBe("All habits");
    expect(at("/habits/0b6c8f5e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/edit")).toBe("All habits");
  });

  it("lists the money pages, Overview only on the root", () => {
    const money = NAV_ITEMS.find((i) => i.href === "/money")!;
    const at = (path: string) => activeChild(money, path)?.label;
    expect(at("/money")).toBe("Overview");
    expect(at("/money/transactions")).toBe("Transactions");
    expect(at("/money/debts")).toBe("Borrow & Lend");
    expect(at("/money/settings")).toBe("Accounts & budgets");
    expect(pageTitle("/money/report")).toBe("Money");
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
