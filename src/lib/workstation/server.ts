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
import { REVISION_PLAN, type LecturePart } from "@/lib/workstation/bcs-syllabus";
import { LECTURE_BOOK_SLICES } from "@/lib/workstation/lecture-books";
import { lectureParts } from "@/lib/workstation/lecture-parts";
import { EXAM_CYCLES, todayItems, type ExamDone, type TodayItem } from "@/lib/workstation/today";

export type WsTopic = {
  id: string;
  title: string;
  parts: LecturePart[];
  estCycles: number;
  done: boolean;
  /** Study day the lecture was marked done, when it is done. */
  doneDay: string | null;
  spentCycles: number;
  /** Chapters of the lecture book covering this lecture, when there is one. */
  book: string | null;
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
  /** Taken in the app (questions, timer, marking) rather than recorded by hand. */
  taken: boolean;
  /** Taken in the app and not submitted yet. */
  inProgress: boolean;
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
  /** Today's planned items, each ticked done or not (empty before the plan starts). */
  today: TodayItem[];
  /** The 7 days of the current week, in order. */
  week: string[];
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
      checks: { select: { day: true, key: true, cycles: true } },
    },
  });
  if (!plan) return null;

  const tz = user.timezone;
  const taskIds = plan.subjects.map((s) => s.taskId);
  const since = parseLocalDateTime(`${addDays(plan.startDay, -7)}T00:00`, tz) ?? at;
  const [slots, sessions] = await Promise.all([
    getRoutineSlots(user.id),
    // Cycles from the study timer, which is gone: kept so earlier days keep their totals.
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
  ]);

  const now = localNow(at, tz);
  const today = now.dayKey;
  const spent = new Map<string, number>();
  for (const s of sessions) {
    if (s.topicId) spent.set(s.topicId, (spent.get(s.topicId) ?? 0) + 1);
  }

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
      doneDay: t.doneAt ? studyDayKeyOf(t.doneAt, tz) : null,
      spentCycles: spent.get(t.id) ?? 0,
      book: LECTURE_BOOK_SLICES[t.title]?.chapters ?? null,
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
    taken: e.questions !== null,
    inProgress: e.startedAt !== null && e.submittedAt === null,
  }));
  // An exam still being taken does not count as done for the plan yet.
  const finished = exams.filter((e) => !e.inProgress);

  const lectures = subjects.filter((s) => !s.isDaily).flatMap((s) => s.topics);
  const dailyTaskIds = new Set(plan.subjects.filter((s) => s.isDaily).map((s) => s.taskId));
  const cyclesByDay = countCyclesByDay({
    timezone: tz,
    sessions,
    lectures,
    checks: plan.checks,
    exams: finished,
  });
  const doneToday = cyclesByDay[today] ?? 0;

  // Lectures studied today: ticked done today, plus older timer cycles on a lecture.
  const studiedToday = new Set(lectures.filter((t) => t.doneDay === today).map((t) => t.id));
  for (const s of sessions) {
    if (s.topicId && !dailyTaskIds.has(s.taskId) && studyDayKeyOf(s.startedAt, tz) === today) {
      studiedToday.add(s.topicId);
    }
  }
  const lecturesDoneToday = studiedToday.size;

  // Vocabulary: ticked on its own check, or (before) studied with the timer.
  const vocabDays = new Set<string>();
  for (const s of sessions) {
    if (dailyTaskIds.has(s.taskId)) vocabDays.add(studyDayKeyOf(s.startedAt, tz));
  }
  for (const c of plan.checks) if (c.key.startsWith("daily:")) vocabDays.add(c.day);
  const wordDays = [...vocabDays].filter((d) => d >= plan.startDay && weekdayOf(d) !== FRIDAY);

  const planSubjects: PlanSubject[] = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    isDaily: s.isDaily,
    topics: s.topics,
    finalDone: finished.some((e) => e.kind === "SUBJECT_FINAL" && e.subjectId === s.id),
  }));

  const base = {
    startDay: plan.startDay,
    learningDays: plan.learningDays,
    revisionDays: plan.revisionDays,
    capacityByWeekday: studyCyclesByWeekday(slots),
    holidayCapacityByWeekday: studyCyclesByWeekday(slots, true),
    holidays: plan.holidays,
    revisionPlan: REVISION_PLAN.map((block) => ({
      days: block.days,
      subjectIds: block.subjects.flatMap((name) => {
        const s = planSubjects.find((x) => x.name === name);
        return s ? [s.id] : [];
      }),
    })),
    today,
  };
  const daysOf = (kind: ExamKind, keepToday: boolean) =>
    finished.filter((e) => e.kind === kind && (keepToday || e.day !== today)).map((e) => e.day);

  // What is left, from now on: drives the projections and the days after today.
  const schedule = buildSchedule({
    ...base,
    subjects: planSubjects,
    doneToday,
    lecturesDoneToday,
    dailyDoneToday: vocabDays.has(today),
    vocabDaysDone: wordDays.length,
    weeklyExamDays: daysOf("WEEKLY", true),
    mockDays: daysOf("MOCK", true),
  });

  // Today as it was planned this morning, before anything was ticked, so done
  // items stay on the list (ticked) instead of dropping off it.
  let todayList: TodayItem[] = [];
  if (today >= plan.startDay) {
    const doneTodayIds = new Set(
      subjects.flatMap((s) => s.topics.filter((t) => t.doneDay === today).map((t) => t.id)),
    );
    const morning = buildSchedule({
      ...base,
      subjects: planSubjects.map((s) => ({
        ...s,
        topics: s.topics.map((t) => (doneTodayIds.has(t.id) ? { ...t, done: false } : t)),
        finalDone: finished.some(
          (e) => e.kind === "SUBJECT_FINAL" && e.subjectId === s.id && e.day !== today,
        ),
      })),
      doneToday: 0,
      lecturesDoneToday: 0,
      dailyDoneToday: false,
      vocabDaysDone: wordDays.filter((d) => d !== today).length,
      weeklyExamDays: daysOf("WEEKLY", false),
      mockDays: daysOf("MOCK", false),
    });
    const planned = morning.days[0]?.day === today ? morning.days[0] : undefined;
    if (planned) {
      schedule.days = schedule.days.map((d) => (d.day === today ? planned : d));
      todayList = todayItems(planned.items, {
        doneTopicIds: new Set(
          subjects.flatMap((s) => s.topics.filter((t) => t.done).map((t) => t.id)),
        ),
        checkedKeys: new Set(plan.checks.filter((c) => c.day === today).map((c) => c.key)),
        examsToday: finished
          .filter((e) => e.day === today && e.kind !== "DAILY")
          .map((e) => ({ kind: e.kind as ExamDone["kind"], subjectId: e.subjectId })),
      });
    }
  }

  const weekStart = startOfWeekKey(today, user.weekStartsOn);
  return {
    plan: {
      id: plan.id,
      name: plan.name,
      startDay: plan.startDay,
      learningDays: plan.learningDays,
      revisionDays: plan.revisionDays,
      holidays: plan.holidays,
    },
    isHoliday: plan.holidays.includes(today),
    subjects,
    slots,
    exams,
    schedule,
    now,
    cyclesByDay,
    doneToday,
    today: todayList,
    week: Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
  };
}

/**
 * Study cycles done per study day: ticked lectures (their estimate), ticked
 * vocabulary and revision, recorded exams, and older timer cycles. A timer
 * cycle on a lecture ticked the same day is the same work, so it is not added.
 */
function countCyclesByDay(input: {
  timezone: string;
  sessions: readonly { startedAt: Date; topicId: string | null }[];
  lectures: readonly { id: string; estCycles: number; doneDay: string | null }[];
  checks: readonly { day: string; cycles: number }[];
  exams: readonly { day: string; kind: string }[];
}): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (day: string, n: number) => {
    if (n > 0) out[day] = (out[day] ?? 0) + n;
  };
  const tickedOn = new Map<string, string>();
  for (const t of input.lectures) {
    if (!t.doneDay) continue;
    tickedOn.set(t.id, t.doneDay);
    add(t.doneDay, t.estCycles);
  }
  for (const s of input.sessions) {
    const day = studyDayKeyOf(s.startedAt, input.timezone);
    if (s.topicId && tickedOn.get(s.topicId) === day) continue;
    add(day, 1);
  }
  for (const c of input.checks) add(c.day, c.cycles);
  for (const e of input.exams) add(e.day, EXAM_CYCLES[e.kind] ?? 0);
  return out;
}

/** Today's and this week's study cycles, for the dashboard card. */
export async function getStudySummary(user: CurrentUser, at = new Date()) {
  const now = localNow(at, user.timezone);
  const weekStart = startOfWeekKey(now.dayKey, user.weekStartsOn);
  const weekEnd = addDays(weekStart, 6);
  const plan = await prisma.studyPlan.findUnique({
    where: { userId: user.id },
    select: {
      holidays: true,
      subjects: {
        select: {
          taskId: true,
          isDaily: true,
          topics: {
            where: { doneAt: { not: null } },
            select: { id: true, estCycles: true, doneAt: true },
          },
        },
      },
      checks: {
        where: { day: { gte: weekStart, lte: weekEnd } },
        select: { day: true, cycles: true },
      },
      exams: {
        where: { day: { gte: weekStart, lte: weekEnd } },
        select: { day: true, kind: true, startedAt: true, submittedAt: true },
      },
    },
  });
  if (!plan) return null;
  const holiday = plan.holidays.includes(now.dayKey);
  // The study week starts at DAY_START_MIN on its first day.
  const since =
    parseLocalDateTime(`${weekStart}T${formatMinute(DAY_START_MIN)}`, user.timezone) ?? at;
  const [sessions, slots] = await Promise.all([
    prisma.pomodoroSession.findMany({
      where: {
        userId: user.id,
        taskId: { in: plan.subjects.map((s) => s.taskId) },
        type: "FOCUS",
        completed: true,
        startedAt: { gte: since },
      },
      select: { startedAt: true, topicId: true },
    }),
    getRoutineSlots(user.id),
  ]);
  const byDay = countCyclesByDay({
    timezone: user.timezone,
    sessions,
    lectures: plan.subjects
      .filter((s) => !s.isDaily)
      .flatMap((s) => s.topics)
      .map((t) => ({
        id: t.id,
        estCycles: t.estCycles,
        doneDay: t.doneAt ? studyDayKeyOf(t.doneAt, user.timezone) : null,
      })),
    checks: plan.checks,
    exams: plan.exams.filter((e) => !(e.startedAt !== null && e.submittedAt === null)),
  });
  const capacity = studyCyclesByWeekday(slots);
  const todayCapacity = studyCyclesByWeekday(slots, holiday);
  const week = Object.entries(byDay)
    .filter(([d]) => d >= weekStart && d <= weekEnd)
    .reduce((n, [, c]) => n + c, 0);
  return {
    today: byDay[now.dayKey] ?? 0,
    todayTarget: todayCapacity[now.weekday],
    week,
    weekTarget: capacity.reduce((a, b) => a + b, 0),
  };
}
