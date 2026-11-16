import { describe, expect, it } from "vitest";
import { normalizeTimezone } from "@/lib/timezone";

describe("normalizeTimezone", () => {
  it("keeps a valid IANA timezone", () => {
    expect(normalizeTimezone("Asia/Dhaka")).toBe("Asia/Dhaka");
    expect(normalizeTimezone("Europe/London")).toBe("Europe/London");
  });

  it("falls back to UTC for empty or invalid values", () => {
    expect(normalizeTimezone("")).toBe("UTC");
    expect(normalizeTimezone(null)).toBe("UTC");
    expect(normalizeTimezone(undefined)).toBe("UTC");
    expect(normalizeTimezone("Not/AZone")).toBe("UTC");
  });
});
