import { describe, expect, it } from "vitest";
import { isDefaultFilters, parseTaskFilters, taskFieldErrors, taskSchema } from "@/schemas/task";

const valid = {
  title: "Write report",
  note: "",
  status: "TODO",
  priority: "HIGH",
  dueAt: "",
  targetMinutes: "",
  habitId: "",
};

describe("taskSchema", () => {
  it("parses a minimal task with nulls for empty optionals", () => {
    const r = taskSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      title: "Write report",
      note: null,
      dueAt: null,
      targetMinutes: null,
      habitId: null,
    });
  });

  it("defaults status and priority when missing", () => {
    const r = taskSchema.safeParse({ title: "x" });
    expect(r.data).toMatchObject({ status: "TODO", priority: "MEDIUM" });
  });

  it("reports field errors", () => {
    const r = taskSchema.safeParse({
      ...valid,
      title: " ",
      priority: "SOMEDAY",
      dueAt: "tomorrow",
      targetMinutes: "0",
      habitId: "abc",
    });
    expect(r.success).toBe(false);
    expect(taskFieldErrors(r.error!)).toEqual({
      title: "Title is required",
      priority: "Pick a priority",
      dueAt: "Enter a valid date and time",
      targetMinutes: "Target minutes must be at least 1",
      habitId: "Pick a habit",
    });
  });

  it("caps title and note length", () => {
    expect(taskSchema.safeParse({ ...valid, title: "x".repeat(121) }).success).toBe(false);
    expect(taskSchema.safeParse({ ...valid, note: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("parseTaskFilters", () => {
  it("returns defaults for empty or unknown params", () => {
    const f = parseTaskFilters({ status: "bogus", sort: ["title", "due"], priority: undefined });
    expect(f).toEqual({ status: "open", priority: "all", due: "all", sort: "title" });
    expect(isDefaultFilters(parseTaskFilters({}))).toBe(true);
  });

  it("accepts valid values", () => {
    expect(
      parseTaskFilters({ status: "DONE", priority: "URGENT", due: "overdue", sort: "priority" }),
    ).toEqual({
      status: "DONE",
      priority: "URGENT",
      due: "overdue",
      sort: "priority",
    });
  });
});
