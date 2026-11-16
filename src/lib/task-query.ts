import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { nextPeriodStart, periodStart, type PeriodContext } from "@/lib/dates";
import type { TaskFilters } from "@/schemas/task";

// Pure query builders (no database access) so they can be unit-tested.

export type Zone = Pick<CurrentUser, "timezone" | "weekStartsOn">;

/** Builds the Prisma `where` for the list filters, scoped to the user. */
export function taskWhere(
  userId: string,
  f: TaskFilters,
  zone: Zone,
  now: Date,
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { userId };

  if (f.status === "open") where.status = { in: ["TODO", "IN_PROGRESS"] };
  else if (f.status !== "all") where.status = f.status;

  if (f.priority !== "all") where.priority = f.priority;

  const ctx = (frequency: "DAILY" | "WEEKLY"): PeriodContext => ({
    frequency,
    timezone: zone.timezone,
    weekStartsOn: zone.weekStartsOn,
  });

  switch (f.due) {
    case "overdue":
      where.dueAt = { lt: now };
      // An overdue task is by definition not done.
      if (f.status === "all" || f.status === "open") where.status = { in: ["TODO", "IN_PROGRESS"] };
      break;
    case "today": {
      const start = periodStart(now, ctx("DAILY"));
      where.dueAt = { gte: start, lt: nextPeriodStart(start, ctx("DAILY")) };
      break;
    }
    case "week": {
      const start = periodStart(now, ctx("WEEKLY"));
      where.dueAt = { gte: start, lt: nextPeriodStart(start, ctx("WEEKLY")) };
      break;
    }
    case "none":
      where.dueAt = null;
      break;
  }
  return where;
}

/** Sort order. Priority enum is declared LOW→URGENT, so `desc` puts urgent first. */
export function taskOrderBy(sort: TaskFilters["sort"]): Prisma.TaskOrderByWithRelationInput[] {
  switch (sort) {
    case "priority":
      return [
        { priority: "desc" },
        { dueAt: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ];
    case "created":
      return [{ createdAt: "desc" }];
    case "title":
      return [{ title: "asc" }, { createdAt: "desc" }];
    case "due":
    default:
      return [
        { dueAt: { sort: "asc", nulls: "last" } },
        { priority: "desc" },
        { createdAt: "desc" },
      ];
  }
}
