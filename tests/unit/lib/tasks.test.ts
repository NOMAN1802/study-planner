import { describe, expect, it } from "vitest";
import { taskOrderBy, taskWhere } from "@/lib/task-query";
import { DEFAULT_FILTERS } from "@/schemas/task";

const zone = { timezone: "Asia/Dhaka", weekStartsOn: 1 as const };
const now = new Date("2026-11-15T10:00:00Z"); // Sun 15 Nov 16:00 Dhaka
const uid = "u1";

describe("taskWhere", () => {
  it("scopes to the user and shows open tasks by default", () => {
    expect(taskWhere(uid, DEFAULT_FILTERS, zone, now)).toEqual({
      userId: uid,
      status: { in: ["TODO", "IN_PROGRESS"] },
    });
  });

  it("filters by a single status and priority", () => {
    expect(
      taskWhere(uid, { ...DEFAULT_FILTERS, status: "DONE", priority: "HIGH" }, zone, now),
    ).toEqual({
      userId: uid,
      status: "DONE",
      priority: "HIGH",
    });
    expect(taskWhere(uid, { ...DEFAULT_FILTERS, status: "all" }, zone, now)).toEqual({
      userId: uid,
    });
  });

  it("uses the user's local day for 'today'", () => {
    const w = taskWhere(uid, { ...DEFAULT_FILTERS, due: "today" }, zone, now);
    expect(w.dueAt).toEqual({
      gte: new Date("2026-11-14T18:00:00Z"),
      lt: new Date("2026-11-15T18:00:00Z"),
    });
  });

  it("uses the user's week start for 'this week'", () => {
    // Dhaka Sunday 15 Nov; Monday-start week began Mon 9 Nov 00:00 local.
    const w = taskWhere(uid, { ...DEFAULT_FILTERS, due: "week" }, zone, now);
    expect(w.dueAt).toEqual({
      gte: new Date("2026-11-08T18:00:00Z"),
      lt: new Date("2026-11-15T18:00:00Z"),
    });
    const sunday = taskWhere(
      uid,
      { ...DEFAULT_FILTERS, due: "week" },
      { ...zone, weekStartsOn: 0 },
      now,
    );
    expect(sunday.dueAt).toEqual({
      gte: new Date("2026-11-14T18:00:00Z"),
      lt: new Date("2026-11-21T18:00:00Z"),
    });
  });

  it("overdue excludes done tasks even with status=all", () => {
    expect(
      taskWhere(uid, { ...DEFAULT_FILTERS, status: "all", due: "overdue" }, zone, now),
    ).toEqual({
      userId: uid,
      dueAt: { lt: now },
      status: { in: ["TODO", "IN_PROGRESS"] },
    });
  });

  it("'none' means no due date", () => {
    expect(taskWhere(uid, { ...DEFAULT_FILTERS, due: "none" }, zone, now).dueAt).toBeNull();
  });
});

describe("taskOrderBy", () => {
  it("sorts by due date with undated tasks last by default", () => {
    expect(taskOrderBy("due")[0]).toEqual({ dueAt: { sort: "asc", nulls: "last" } });
  });
  it("sorts by priority, most urgent first", () => {
    expect(taskOrderBy("priority")[0]).toEqual({ priority: "desc" });
  });
});
