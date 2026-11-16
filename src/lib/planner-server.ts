import type { CurrentUser } from "@/lib/auth";
import { formatDue } from "@/lib/dates";
import {
  dayInfo,
  defaultBlockMinutes,
  viewDayKeys,
  type DayInfo,
  type PlannerView,
} from "@/lib/planner";
import { prisma } from "@/lib/prisma";

export type PlannerBlock = {
  id: string;
  start: number;
  end: number;
  kind: "task" | "habit" | "free";
  refId: string | null;
  title: string;
  color: string | null;
  done: boolean;
};

export type PaletteItem = {
  kind: "task" | "habit";
  id: string;
  title: string;
  color: string | null;
  detail: string | null;
  defaultMinutes: number;
};

export type PlannerData = {
  days: DayInfo[];
  blocks: PlannerBlock[];
  palette: PaletteItem[];
};

const blockInclude = {
  task: { select: { id: true, title: true, status: true, habit: { select: { color: true } } } },
  habit: { select: { id: true, name: true, color: true } },
} as const;

type BlockRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  title: string | null;
  task: { id: string; title: string; status: string; habit: { color: string } | null } | null;
  habit: { id: string; name: string; color: string } | null;
};

export function toPlannerBlock(row: BlockRow): PlannerBlock {
  if (row.task) {
    return {
      id: row.id,
      start: row.startAt.getTime(),
      end: row.endAt.getTime(),
      kind: "task",
      refId: row.task.id,
      title: row.task.title,
      color: row.task.habit?.color ?? null,
      done: row.task.status === "DONE",
    };
  }
  if (row.habit) {
    return {
      id: row.id,
      start: row.startAt.getTime(),
      end: row.endAt.getTime(),
      kind: "habit",
      refId: row.habit.id,
      title: row.habit.name,
      color: row.habit.color,
      done: false,
    };
  }
  // The linked task/habit was deleted (SetNull): keep the block as free time.
  return {
    id: row.id,
    start: row.startAt.getTime(),
    end: row.endAt.getTime(),
    kind: "free",
    refId: null,
    title: row.title ?? "Untitled block",
    color: null,
    done: false,
  };
}

export async function getBlockForUser(userId: string, id: string) {
  const row = await prisma.timeBlock.findFirst({ where: { id, userId }, include: blockInclude });
  return row ? toPlannerBlock(row) : null;
}

export async function getPlannerData(
  user: CurrentUser,
  view: PlannerView,
  date: string,
  now = new Date(),
): Promise<PlannerData> {
  const days = viewDayKeys(view, date, user.weekStartsOn).map((key) => dayInfo(key, user.timezone));
  const from = new Date(days[0].start);
  const to = new Date(days[days.length - 1].end);

  const [rows, tasks, habits] = await Promise.all([
    prisma.timeBlock.findMany({
      where: { userId: user.id, startAt: { lt: to }, endAt: { gt: from } },
      orderBy: { startAt: "asc" },
      include: blockInclude,
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: [
        { dueAt: { sort: "asc", nulls: "last" } },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        dueAt: true,
        targetMinutes: true,
        actualMinutes: true,
        habit: { select: { color: true } },
      },
      take: 100,
    }),
    prisma.habit.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, color: true, targetMinutes: true, frequency: true },
    }),
  ]);

  const palette: PaletteItem[] = [
    ...tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: t.title,
      color: t.habit?.color ?? null,
      detail: t.dueAt ? `Due ${formatDue(t.dueAt, user.timezone, now)}` : null,
      defaultMinutes: defaultBlockMinutes({
        kind: "task",
        targetMinutes: t.targetMinutes,
        actualMinutes: t.actualMinutes,
      }),
    })),
    ...habits.map((h) => ({
      kind: "habit" as const,
      id: h.id,
      title: h.name,
      color: h.color,
      detail: h.frequency.charAt(0) + h.frequency.slice(1).toLowerCase(),
      defaultMinutes: defaultBlockMinutes({ kind: "habit", targetMinutes: h.targetMinutes }),
    })),
  ];

  return { days, blocks: rows.map(toPlannerBlock), palette };
}
