/**
 * The study plan, computed — never stored. Remaining work is laid out from
 * today across the routine's study cycles, so missed days push projections
 * out instead of leaving a stale timetable.
 *
 * Days 1…learningDays: subjects one at a time (in order), one vocabulary cycle
 * a day, weekly revision + exam on Fridays, and a revision + final exam after
 * each subject's last topic. The next revisionDays: rotating revision with a
 * mock test every second day. Learning work that does not fit spills into the
 * revision phase (and beyond) and is reported as overflow.
 */
import { addDays, weekdayOf } from "@/lib/planner";
import { FRIDAY } from "@/lib/workstation/routine";

export const DAILY_CYCLES = 1;
export const WEEKLY_REVISION_CYCLES = 3;
export const WEEKLY_EXAM_CYCLES = 1;
export const FINAL_REVISION_CYCLES = 2;
export const FINAL_EXAM_CYCLES = 1;
export const MOCK_CYCLES = 3;
/** Revision days give each subject a block of this many cycles before rotating. */
export const REVISION_BLOCK = 4;
/** How far past the planned end overflowing work is still laid out. */
const MAX_OVERFLOW_DAYS = 180;

export type PlanTopic = {
  id: string;
  title: string;
  estCycles: number;
  done: boolean;
  /** Focus cycles already spent on this topic. */
  spentCycles: number;
};

export type PlanSubject = {
  id: string;
  name: string;
  color: string;
  isDaily: boolean;
  topics: PlanTopic[];
  finalDone: boolean;
};

export type ScheduleInput = {
  startDay: string;
  learningDays: number;
  revisionDays: number;
  /** Study cycles per weekday, index 0 (Sun) … 6 (Sat). */
  capacityByWeekday: readonly number[];
  /** In study order; the daily subject (vocabulary) may appear anywhere. */
  subjects: readonly PlanSubject[];
  today: string;
  /** Study cycles already completed today (any subject). */
  doneToday: number;
  /** A cycle on the daily subject was already completed today. */
  dailyDoneToday: boolean;
  /** Days that already have a recorded weekly exam / mock test. */
  weeklyExamDays: readonly string[];
  mockDays: readonly string[];
};

export type ItemKind =
  | "topic"
  | "daily"
  | "weekly-revision"
  | "weekly-exam"
  | "subject-revision"
  | "subject-final"
  | "revision"
  | "mock";

export type PlanItem = {
  kind: ItemKind;
  cycles: number;
  label: string;
  subjectId?: string;
  topicId?: string;
};

export type Phase = "learning" | "revision" | "overflow";

export type PlanDay = {
  day: string;
  phase: Phase;
  /** Day number in the plan, 1-based. */
  index: number;
  capacity: number;
  items: PlanItem[];
};

export type SubjectProjection = {
  subjectId: string;
  status: "done" | "current" | "upcoming";
  doneTopics: number;
  totalTopics: number;
  remainingCycles: number;
  projectedStart: string | null;
  /** Day of the subject final (or last topic when the final is already done). */
  projectedEnd: string | null;
};

export type Schedule = {
  days: PlanDay[];
  subjects: SubjectProjection[];
  planEnd: string;
  learningEnd: string;
  /** Day the last learning-phase item lands on (null when nothing is left). */
  projectedLearningEnd: string | null;
  remainingLearningCycles: number;
  /** Free cycles left in the learning phase after daily/weekly reservations. */
  learningCapacityLeft: number;
  /** Positive = spare cycles; negative = cycles that don't fit before the revision phase. */
  bufferCycles: number;
};

type Work = PlanItem & { learning: true };

/** The ordered queue of learning work still to do. */
function learningQueue(subjects: readonly PlanSubject[]): Work[] {
  const queue: Work[] = [];
  for (const s of subjects) {
    if (s.isDaily) continue;
    for (const t of s.topics) {
      if (t.done) continue;
      queue.push({
        learning: true,
        kind: "topic",
        cycles: Math.max(1, t.estCycles - t.spentCycles),
        label: t.title,
        subjectId: s.id,
        topicId: t.id,
      });
    }
    if (!s.finalDone && s.topics.length > 0) {
      queue.push({
        learning: true,
        kind: "subject-revision",
        cycles: FINAL_REVISION_CYCLES,
        label: `${s.name} — revision`,
        subjectId: s.id,
      });
      queue.push({
        learning: true,
        kind: "subject-final",
        cycles: FINAL_EXAM_CYCLES,
        label: `${s.name} — final exam`,
        subjectId: s.id,
      });
    }
  }
  return queue;
}

function nextDailyTopic(subject: PlanSubject | undefined) {
  return subject?.topics.find((t) => !t.done);
}

function phaseOf(index: number, learningDays: number, revisionDays: number): Phase {
  if (index <= learningDays) return "learning";
  if (index <= learningDays + revisionDays) return "revision";
  return "overflow";
}

export function buildSchedule(input: ScheduleInput): Schedule {
  const { startDay, learningDays, revisionDays, subjects, today } = input;
  const learningEnd = addDays(startDay, learningDays - 1);
  const planEnd = addDays(startDay, learningDays + revisionDays - 1);
  const from = today > startDay ? today : startDay;
  const weeklyDone = new Set(input.weeklyExamDays);
  const mockDone = new Set(input.mockDays);

  const daily = subjects.find((s) => s.isDaily);
  const study = subjects.filter((s) => !s.isDaily);
  const queue = learningQueue(subjects);
  const remainingLearningCycles = queue.reduce((n, w) => n + w.cycles, 0);

  const days: PlanDay[] = [];
  let learningCapacityLeft = 0;
  let projectedLearningEnd: string | null = null;
  let revisionTurn = 0;

  for (let day = from; ; day = addDays(day, 1)) {
    const index = Math.round((Date.parse(day) - Date.parse(startDay)) / 86_400_000) + 1;
    const phase = phaseOf(index, learningDays, revisionDays);
    if (
      phase === "overflow" &&
      (queue.length === 0 || index > learningDays + revisionDays + MAX_OVERFLOW_DAYS)
    )
      break;

    const weekday = weekdayOf(day);
    const fullCapacity = input.capacityByWeekday[weekday] ?? 0;
    const isToday = day === today;
    let free = isToday ? Math.max(0, fullCapacity - input.doneToday) : fullCapacity;
    const items: PlanItem[] = [];
    const take = (item: PlanItem) => {
      const cycles = Math.min(item.cycles, free);
      if (cycles <= 0) return 0;
      items.push({ ...item, cycles });
      free -= cycles;
      return cycles;
    };

    // Daily subject (vocabulary) first, every day of the plan.
    if (daily && !(isToday && input.dailyDoneToday)) {
      const topic = nextDailyTopic(daily);
      take({
        kind: "daily",
        cycles: DAILY_CYCLES,
        label: topic ? topic.title : `${daily.name} — practice`,
        subjectId: daily.id,
        topicId: topic?.id,
      });
    }

    // Friday reservations (learning phase only; revision days have their own shape).
    const fridayReserve =
      phase === "learning" && weekday === FRIDAY && !weeklyDone.has(day)
        ? WEEKLY_REVISION_CYCLES + WEEKLY_EXAM_CYCLES
        : 0;
    const mockDay = phase === "revision" && (index - learningDays) % 2 === 0;
    const mockReserve = mockDay && !mockDone.has(day) ? MOCK_CYCLES : 0;
    const reserve = Math.min(free, fridayReserve + mockReserve);
    free -= reserve;

    if (phase === "learning") learningCapacityLeft += free;

    // Learning work: always first in line, even after the learning phase (overflow).
    while (free > 0 && queue.length > 0) {
      const head = queue[0];
      const used = take(head);
      head.cycles -= used;
      if (head.cycles <= 0) queue.shift();
      projectedLearningEnd = day;
    }

    free += reserve;
    if (fridayReserve > 0) {
      take({ kind: "weekly-revision", cycles: WEEKLY_REVISION_CYCLES, label: "Weekly revision" });
      take({ kind: "weekly-exam", cycles: WEEKLY_EXAM_CYCLES, label: "Weekly exam" });
    }
    if (mockReserve > 0) {
      take({ kind: "mock", cycles: MOCK_CYCLES, label: "Mock test (full syllabus)" });
    }

    // Revision phase (or learning finished early): rotate through subjects in blocks.
    if ((phase === "revision" || queue.length === 0) && study.length > 0) {
      while (free > 0) {
        const s = study[revisionTurn % study.length];
        revisionTurn += 1;
        take({
          kind: "revision",
          cycles: REVISION_BLOCK,
          label: `Revise ${s.name}`,
          subjectId: s.id,
        });
      }
    }

    days.push({ day, phase, index, capacity: fullCapacity, items });
  }

  return {
    days,
    subjects: projectSubjects(subjects, days),
    planEnd,
    learningEnd,
    projectedLearningEnd,
    remainingLearningCycles,
    learningCapacityLeft,
    bufferCycles: learningCapacityLeft - remainingLearningCycles,
  };
}

function projectSubjects(subjects: readonly PlanSubject[], days: readonly PlanDay[]) {
  const first = new Map<string, string>();
  const last = new Map<string, string>();
  const remaining = new Map<string, number>();
  for (const d of days) {
    for (const item of d.items) {
      if (!item.subjectId) continue;
      if (
        item.kind !== "topic" &&
        item.kind !== "subject-revision" &&
        item.kind !== "subject-final"
      )
        continue;
      if (!first.has(item.subjectId)) first.set(item.subjectId, d.day);
      last.set(item.subjectId, d.day);
      remaining.set(item.subjectId, (remaining.get(item.subjectId) ?? 0) + item.cycles);
    }
  }
  let currentFound = false;
  return subjects
    .filter((s) => !s.isDaily)
    .map((s): SubjectProjection => {
      const doneTopics = s.topics.filter((t) => t.done).length;
      const finished = s.finalDone && doneTopics === s.topics.length;
      let status: SubjectProjection["status"] = "upcoming";
      if (finished) status = "done";
      else if (!currentFound) {
        status = "current";
        currentFound = true;
      }
      return {
        subjectId: s.id,
        status,
        doneTopics,
        totalTopics: s.topics.length,
        remainingCycles: remaining.get(s.id) ?? 0,
        projectedStart: first.get(s.id) ?? null,
        projectedEnd: last.get(s.id) ?? null,
      };
    });
}

/** The study items of one day, expanded to one label per cycle (for the timeline). */
export function cycleLabels(items: readonly PlanItem[]): PlanItem[] {
  return items.flatMap((item) =>
    Array.from({ length: item.cycles }, () => ({ ...item, cycles: 1 })),
  );
}
