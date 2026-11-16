import { describe, expect, it } from "vitest";
import { formatDue, parseLocalDateTime, toLocalDateTimeInput } from "@/lib/dates";

describe("parseLocalDateTime", () => {
  it("interprets the value as wall-clock time in the timezone", () => {
    expect(parseLocalDateTime("2026-11-16T09:30", "Asia/Dhaka")?.toISOString()).toBe(
      "2026-11-16T03:30:00.000Z",
    );
    expect(parseLocalDateTime("2026-11-16T09:30", "UTC")?.toISOString()).toBe(
      "2026-11-16T09:30:00.000Z",
    );
    expect(parseLocalDateTime("2026-07-01T09:00", "America/New_York")?.toISOString()).toBe(
      "2026-07-01T13:00:00.000Z",
    );
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseLocalDateTime("2026-02-31T10:00", "UTC")).toBeNull();
    expect(parseLocalDateTime("2026-13-01T10:00", "UTC")).toBeNull();
    expect(parseLocalDateTime("2026-11-16 09:30", "UTC")).toBeNull();
    expect(parseLocalDateTime("", "UTC")).toBeNull();
  });

  it("round-trips with toLocalDateTimeInput", () => {
    for (const tz of ["UTC", "Asia/Dhaka", "Asia/Kolkata", "America/Los_Angeles"]) {
      const d = parseLocalDateTime("2026-03-20T23:45", tz)!;
      expect(toLocalDateTimeInput(d, tz)).toBe("2026-03-20T23:45");
    }
  });
});

describe("formatDue", () => {
  const now = new Date("2026-11-15T10:00:00Z"); // Sun 15 Nov, 16:00 in Dhaka

  it("uses relative day names around today in the user's timezone", () => {
    expect(formatDue(new Date("2026-11-15T12:00:00Z"), "Asia/Dhaka", now)).toBe("Today 18:00");
    expect(formatDue(new Date("2026-11-15T19:00:00Z"), "Asia/Dhaka", now)).toBe("Tomorrow 01:00");
    expect(formatDue(new Date("2026-11-14T03:00:00Z"), "Asia/Dhaka", now)).toBe("Yesterday 09:00");
    // Same instant is still "today" in UTC.
    expect(formatDue(new Date("2026-11-15T19:00:00Z"), "UTC", now)).toBe("Today 19:00");
  });

  it("shows weekday and date further out, and the year when it differs", () => {
    expect(formatDue(new Date("2026-11-20T04:00:00Z"), "UTC", now)).toBe("Fri 20 Nov 04:00");
    expect(formatDue(new Date("2027-01-05T09:00:00Z"), "UTC", now)).toBe("5 Jan 2027 09:00");
  });
});
