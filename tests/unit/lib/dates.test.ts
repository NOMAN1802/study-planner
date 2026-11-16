import { describe, expect, it } from "vitest";
import {
  isActivePeriod,
  listPeriodStarts,
  localHour,
  nextPeriodStart,
  periodStart,
  previousPeriodStart,
  type Frequency,
  type PeriodContext,
  type WeekStart,
} from "@/lib/dates";

const ctx = (
  frequency: Frequency,
  timezone = "UTC",
  weekStartsOn: WeekStart = 1,
): PeriodContext => ({
  frequency,
  timezone,
  weekStartsOn,
});
const iso = (d: Date) => d.toISOString();
const at = (s: string) => new Date(s);

describe("periodStart — daily", () => {
  it("uses midnight in the user's timezone, not UTC", () => {
    // 2026-03-10 20:30 UTC is 2026-03-11 02:30 in Dhaka (UTC+6).
    expect(iso(periodStart(at("2026-03-10T20:30:00Z"), ctx("DAILY", "Asia/Dhaka")))).toBe(
      "2026-03-10T18:00:00.000Z",
    );
    // Same instant in New York (UTC-4 in March after DST) is still 2026-03-10.
    expect(iso(periodStart(at("2026-03-10T20:30:00Z"), ctx("DAILY", "America/New_York")))).toBe(
      "2026-03-10T04:00:00.000Z",
    );
  });

  it("treats the last millisecond of the day as the same day", () => {
    expect(iso(periodStart(at("2026-03-10T17:59:59.999Z"), ctx("DAILY", "Asia/Dhaka")))).toBe(
      "2026-03-09T18:00:00.000Z",
    );
  });

  it("handles a 23-hour DST day (US spring forward)", () => {
    const c = ctx("DAILY", "America/New_York");
    const start = periodStart(at("2026-03-08T12:00:00Z"), c);
    expect(iso(start)).toBe("2026-03-08T05:00:00.000Z"); // midnight EST
    expect(iso(nextPeriodStart(start, c))).toBe("2026-03-09T04:00:00.000Z"); // midnight EDT
  });

  it("handles a 25-hour DST day (US fall back)", () => {
    const c = ctx("DAILY", "America/New_York");
    const start = periodStart(at("2026-11-01T12:00:00Z"), c);
    expect(iso(start)).toBe("2026-11-01T04:00:00.000Z");
    expect(iso(nextPeriodStart(start, c))).toBe("2026-11-02T05:00:00.000Z");
  });
});

describe("periodStart — weekly", () => {
  // 2026-03-11 is a Wednesday.
  const wed = at("2026-03-11T12:00:00Z");

  it("starts on Monday when weekStartsOn = 1", () => {
    expect(iso(periodStart(wed, ctx("WEEKLY", "UTC", 1)))).toBe("2026-03-09T00:00:00.000Z");
  });

  it("starts on Sunday when weekStartsOn = 0", () => {
    expect(iso(periodStart(wed, ctx("WEEKLY", "UTC", 0)))).toBe("2026-03-08T00:00:00.000Z");
  });

  it("starts on Saturday when weekStartsOn = 6", () => {
    expect(iso(periodStart(wed, ctx("WEEKLY", "UTC", 6)))).toBe("2026-03-07T00:00:00.000Z");
  });

  it("a week-start day belongs to its own week", () => {
    const monday = at("2026-03-09T00:00:00Z");
    expect(iso(periodStart(monday, ctx("WEEKLY", "UTC", 1)))).toBe("2026-03-09T00:00:00.000Z");
  });

  it("uses the local weekday, which can differ from the UTC weekday", () => {
    // Sunday 2026-03-08 23:00 UTC is Monday 05:00 in Dhaka → new week there.
    const instant = at("2026-03-08T23:00:00Z");
    expect(iso(periodStart(instant, ctx("WEEKLY", "UTC", 1)))).toBe("2026-03-02T00:00:00.000Z");
    expect(iso(periodStart(instant, ctx("WEEKLY", "Asia/Dhaka", 1)))).toBe(
      "2026-03-08T18:00:00.000Z",
    );
  });

  it("spans a year boundary", () => {
    // Thu 2026-01-01 → week starting Mon 2025-12-29.
    expect(iso(periodStart(at("2026-01-01T10:00:00Z"), ctx("WEEKLY", "UTC", 1)))).toBe(
      "2025-12-29T00:00:00.000Z",
    );
  });
});

describe("periodStart — monthly", () => {
  it("starts on the 1st at local midnight", () => {
    expect(iso(periodStart(at("2026-02-28T23:00:00Z"), ctx("MONTHLY", "Asia/Dhaka")))).toBe(
      "2026-02-28T18:00:00.000Z", // 1 March 00:00 in Dhaka
    );
    expect(iso(periodStart(at("2026-02-28T23:00:00Z"), ctx("MONTHLY", "UTC")))).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });

  it("steps through months of different lengths", () => {
    const c = ctx("MONTHLY", "UTC");
    let p = periodStart(at("2026-01-15T00:00:00Z"), c);
    const seen = [iso(p)];
    for (let i = 0; i < 3; i += 1) {
      p = nextPeriodStart(p, c);
      seen.push(iso(p));
    }
    expect(seen).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
      "2026-03-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
    ]);
  });

  it("handles leap February", () => {
    const c = ctx("MONTHLY", "UTC");
    expect(iso(nextPeriodStart(at("2028-02-01T00:00:00Z"), c))).toBe("2028-03-01T00:00:00.000Z");
    expect(iso(periodStart(at("2028-02-29T12:00:00Z"), c))).toBe("2028-02-01T00:00:00.000Z");
  });
});

describe("periodStart — hourly", () => {
  it("truncates to the local hour, including half-hour offsets", () => {
    // India is UTC+05:30, so local hours start at :30 UTC.
    expect(iso(periodStart(at("2026-03-10T10:10:00Z"), ctx("HOURLY", "Asia/Kolkata")))).toBe(
      "2026-03-10T09:30:00.000Z",
    );
    expect(iso(periodStart(at("2026-03-10T10:10:00Z"), ctx("HOURLY", "UTC")))).toBe(
      "2026-03-10T10:00:00.000Z",
    );
  });

  it("produces distinct periods for the repeated hour at DST fall back", () => {
    const c = ctx("HOURLY", "America/New_York");
    // 01:00–02:00 local happens twice on 2026-11-01 (EDT then EST).
    const first = periodStart(at("2026-11-01T05:30:00Z"), c);
    const second = nextPeriodStart(first, c);
    expect(iso(first)).toBe("2026-11-01T05:00:00.000Z");
    expect(iso(second)).toBe("2026-11-01T06:00:00.000Z");
    expect(localHour(first, c.timezone)).toBe(1);
    expect(localHour(second, c.timezone)).toBe(1);
  });
});

describe("previousPeriodStart", () => {
  it("is the inverse of nextPeriodStart", () => {
    for (const f of ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const) {
      const c = ctx(f, "Europe/London", 1);
      const p = periodStart(at("2026-03-29T12:00:00Z"), c); // UK DST change day
      expect(iso(previousPeriodStart(nextPeriodStart(p, c), c))).toBe(iso(p));
    }
  });
});

describe("isActivePeriod", () => {
  it("only filters hourly periods", () => {
    const daily = ctx("DAILY", "UTC");
    expect(isActivePeriod(at("2026-03-10T00:00:00Z"), daily, [9])).toBe(true);
  });

  it("checks the local hour for hourly periods", () => {
    const c = ctx("HOURLY", "Asia/Dhaka");
    // 03:00 UTC = 09:00 Dhaka
    expect(isActivePeriod(at("2026-03-10T03:00:00Z"), c, [9, 10])).toBe(true);
    expect(isActivePeriod(at("2026-03-10T09:00:00Z"), c, [9, 10])).toBe(false);
    expect(isActivePeriod(at("2026-03-10T09:00:00Z"), c, [])).toBe(true);
  });
});

describe("listPeriodStarts", () => {
  it("is inclusive at both ends", () => {
    const starts = listPeriodStarts(
      at("2026-03-01T10:00:00Z"),
      at("2026-03-03T01:00:00Z"),
      ctx("DAILY", "UTC"),
    );
    expect(starts.map(iso)).toEqual([
      "2026-03-01T00:00:00.000Z",
      "2026-03-02T00:00:00.000Z",
      "2026-03-03T00:00:00.000Z",
    ]);
  });
});
