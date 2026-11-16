import { describe, expect, it } from "vitest";
import { MINUTE_MS } from "@/lib/planner";
import { createBlockSchema, spanSchema } from "@/schemas/planner";

const start = Date.UTC(2030, 0, 15, 10);
const id = "3f6c2d0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f";

describe("planner schemas", () => {
  it("accepts a valid span", () => {
    expect(spanSchema.safeParse({ start, end: start + 15 * MINUTE_MS }).success).toBe(true);
  });

  it("rejects too short, too long, reversed and absurd spans", () => {
    expect(
      spanSchema.safeParse({ start, end: start + 10 * MINUTE_MS }).error?.issues[0].message,
    ).toBe("A block must be at least 15 minutes");
    expect(
      spanSchema.safeParse({ start, end: start + 25 * 60 * MINUTE_MS }).error?.issues[0].message,
    ).toBe("A block can't be longer than 24 hours");
    expect(spanSchema.safeParse({ start, end: start - MINUTE_MS }).success).toBe(false);
    expect(spanSchema.safeParse({ start: 0, end: 15 * MINUTE_MS }).success).toBe(false);
    expect(spanSchema.safeParse({ start: 1.5, end: start }).success).toBe(false);
  });

  it("requires a kind and a uuid reference", () => {
    expect(
      createBlockSchema.safeParse({ kind: "task", refId: id, start, end: start + 60 * MINUTE_MS })
        .success,
    ).toBe(true);
    expect(
      createBlockSchema.safeParse({ kind: "note", refId: id, start, end: start + 60 * MINUTE_MS })
        .success,
    ).toBe(false);
    expect(
      createBlockSchema.safeParse({ kind: "habit", refId: "x", start, end: start + 60 * MINUTE_MS })
        .success,
    ).toBe(false);
  });
});
