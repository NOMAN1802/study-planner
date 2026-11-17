import type { CurrentUser } from "@/lib/auth";
import { parseLocalDateTime } from "@/lib/dates";
import { addDays, startOfWeekKey, weekdayOf } from "@/lib/planner";
import { prisma } from "@/lib/prisma";
import {
  DAY_START_MIN,
  FRIDAY,
  formatMinute,
  localNow,
  studyCyclesByWeekday,
  studyDayKeyOf,
  type LocalNow,
  type RoutineKind,
  type Slot,
} from "@/lib/workstation/routine";
import { buildSchedule, type PlanSubject, type Schedule } from "@/lib/workstation/schedule";
import type { ExamKind } from "@/schemas/workstation";
import type { LecturePart } from "@/lib/workstation/bcs-syllabus";
import { lectureParts } from "@/lib/workstation/lecture-parts";

export type WsTopic = {
  id: string;
  title: string;
  parts: LecturePart[];
  estCycles: number;
  done: boolean;
  spentCycles: number;
};
export type WsSubject = {
  id: string;
  taskId: string;
  name: string;
  color: string;
  isDaily: boolean;
  resourceFile: string | null;
  topics: WsTopic[];
};
export type WsExam = {
  id: string;
  kind: ExamKind;
  day: string;
  subjectId: string | null;
  score: number | null;
  total: number | null;
  note: string | null;
};
export type WsSlot = Slot & { id: string };

export type WorkstationData = {
  plan: {
    id: string;
    name: string;
    startDay: string;
    learningDays: number;
    revisionDays: number;
    holidays: string[];
  };
  /** The current study day is a holiday (studied like a Friday). */
  isHoliday: boolean;
  subjects: WsSubject[];
  slots: WsSlot[];
  exams: WsExam[];
  schedule: Schedule;
  now: LocalNow;
  /** Completed study cycles per local day (only days with any). */
  cyclesByDay: Record<string, number>;
  doneToday: number;
  /** The 7 days of the current week, in order. */
  week: string[];
  activeTimer: { taskId: string; topicId: string | null } | null;
};

export async function getRoutineSlots(userId: string): Promise<WsSlot[]> {
  const rows = await prisma.routineSlot.findMany({
    where: { userId },
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    startMin: r.startMin,
    endMin: r.endMin,
    kind: r.kind as RoutineKind,
    label: r.label,
  }));
}

export async function hasStudyPlan(userId: string) {
  return (await prisma.studyPlan.count({ where: { userId } })) > 0;
}

export async function getWorkstationData(
  user: CurrentUser,
  at = new Date(),
): Promise<WorkstationData | null> {
  const plan = await prisma.studyPlan.findUnique({
    where: { userId: user.id },
    include: {
      subjects: {
        orderBy: { sortOrder: "asc" },
        include: { topics: { orderBy: { sortOrder: "asc" } } },
      },
      exams: { orderBy: [{ day: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!plan) return null;

  const taskIds = plan.subjects.map((s) => s.taskId);
  const since = parseLocalDateTime(`${addDays(plan.startDay, -7)}T00:00`, user.timezone) ?? at;
  const [slots, sessions, active] = await Promise.all([
    getRoutineSlots(user.id),
    prisma.pomodoroSession.findMany({
      where: {
        userId: user.id,
        taskId: { in: taskIds },
        type: "FOCUS",
        completed: true,
        startedAt: { gte: since },
      },
      select: { taskId: true, topicId: true, startedAt: true },
    }),
    prisma.pomodoroSession.findFirst({
      where: { userId: user.id, endedAt: null, taskId: { in: taskIds } },
      select: { taskId: true, topicId: true },
    }),
  ]);

  const now = localNow(at, user.timezone);
  const cyclesByDay: Record<string, number> = {};
  const spent = new Map<string, number>();
  const dailyTaskIds = new Set(plan.subjects.filter((s) => s.isDaily).map((s) => s.taskId));
  let dailyDoneToday = false;
  const wordDays = new Set<string>();
  for (const s of sessions) {
    const day = studyDayKeyOf(s.startedAt, user.timezone);
    cyclesByDay[day] = (cyclesByDay[day] ?? 0) + 1;
    if (s.topicId) spent.set(s.topicId, (spent.get(s.topicId) ?? 0) + 1);
    if (!dailyTaskIds.has(s.taskId)) continue;
    if (day === now.dayKey) dailyDoneToday = true;
    if (day >= plan.startDay && weekdayOf(day) !== FRIDAY) wordDays.add(day);
  }
  const doneToday = cyclesByDay[now.dayKey] ?? 0;

  const subjects: WsSubject[] = plan.subjects.map((s) => ({
    id: s.id,
    taskId: s.taskId,
    name: s.name,
    color: s.color,
    isDaily: s.isDaily,
    resourceFile: s.resourceFile,
    topics: s.topics.map((t) => ({
      id: t.id,
      title: t.title,
      parts: lectureParts(t.parts, t.url),
      estCycles: t.estCycles,
      done: t.doneAt !== null,
      spentCycles: spent.get(t.id) ?? 0,
    })),
  }));

  const exams: WsExam[] = plan.exams.map((e) => ({
    id: e.id,
    kind: e.kind as ExamKind,
    day: e.day,
    subjectId: e.subjectId,
    score: e.score,
    total: e.total,
    note: e.note,
  }));
  const finals = new Set(exams.filter((e) => e.kind === "SUBJECT_FINAL").map((e) => e.subjectId));

  const planSubjects: PlanSubject[] = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    isDaily: s.isDaily,
    topics: s.topics,
    finalDone: finals.has(s.id),
  }));

  const schedule = buildSchedule({
    startDay: plan.startDay,
    learningDays: plan.learningDays,
    revisionDays: plan.revisionDays,
    capacityByWeekday: studyCyclesByWeekday(slots),
    holidayCapacityByWeekday: studyCyclesByWeekday(slots, true),
    holidays: plan.holidays,
    subjects: planSubjects,
    today: now.dayKey,
    doneToday,
    dailyDoneToday,
    vocabDaysDone: wordDays.size,
    weeklyExamDays: exams.filter((e) => e.kind === "WEEKLY").map((e) => e.day),
    mockDays: exams.filter((e) => e.kind === "MOCK").map((e) => e.day),
  });

  const weekStart = startOfWeekKey(now.dayKey, user.weekStartsOn);
  return {
    plan: {
      id: plan.id,
      name: plan.name,
      startDay: plan.startDay,
      learningDays: plan.learningDays,
      revisionDays: plan.revisionDays,
      holidays: plan.holidays,
    },
    isHoliday: plan.holidays.includes(now.dayKey),
    subjects,
    slots,
    exams,
    schedule,
    now,
    cyclesByDay,
    doneToday,
    week: Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    activeTimer: active,
  };
}

/** Today's and this week's study cycles, for the dashboard card. */
export async function getStudySummary(user: CurrentUser, at = new Date()) {
  const plan = await prisma.studyPlan.findUnique({
    where: { userId: user.id },
    select: { holidays: true, subjects: { select: { taskId: true } } },
  });
  if (!plan) return null;
  const now = localNow(at, user.timezone);
  const holiday = plan.holidays.includes(now.dayKey);
  const weekStart = startOfWeekKey(now.dayKey, user.weekStartsOn);
  // The study week starts the evening before its first day.
  const since =
    parseLocalDateTime(`${addDays(weekStart, -1)}T${formatMinute(DAY_START_MIN)}`, user.timezone) ??
    at;
  const [sessions, slots] = await Promise.all([
    prisma.pomodoroSession.findMany({
      where: {
        userId: user.id,
        taskId: { in: plan.subjects.map((s) => s.taskId) },
        type: "FOCUS",
        completed: true,
        startedAt: { gte: since },
      },
      select: { startedAt: true },
    }),
    getRoutineSlots(user.id),
  ]);
  const capacity = studyCyclesByWeekday(slots);
  const todayCapacity = studyCyclesByWeekday(slots, holiday);
  const today = sessions.filter(
    (s) => studyDayKeyOf(s.startedAt, user.timezone) === now.dayKey,
  ).length;
  return {
    today,
    todayTarget: todayCapacity[now.weekday],
    week: sessions.length,
    weekTarget: capacity.reduce((a, b) => a + b, 0),
  };
}
