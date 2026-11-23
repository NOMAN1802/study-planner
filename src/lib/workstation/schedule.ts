/**
 * The study plan, computed — never stored. Remaining work is laid out from
 * today across the routine's study cycles, so missed days push projections
 * out instead of leaving a stale timetable.
 *
 * Days 1…learningDays: subjects one at a time (in order), one vocabulary cycle
 * a day (10 new words Saturday–Thursday, revising the week's words on Friday),
 * at most LECTURES_PER_DAY lectures a day (HOLIDAY_LECTURES on Friday and
 * holidays, which follow the Friday routine: 2 and 3 lectures)
 * with the rest of the study session spent revising what was covered, weekly
 * revision + exam on Fridays, and a subject final day after each subject's
 * last topic (its revision + final exam, no lectures, the rest of the day off).
 * The next revisionDays: whole days per subject following the revision plan
 * when one is given, otherwise (and after it) rotating revision with a mock
 * test every second day. Learning work that does not fit spills into the
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
/** Lectures a day (office days), however long each lecture is. */
export const LECTURES_PER_DAY = 2;
/**
 * Lectures on Friday and holidays, leaving room for the weekly revision and
 * exam (Friday) and some revision.
 */
export const HOLIDAY_LECTURES = 3;
/** New vocabulary words per word day (every day except Friday). */
export const WORDS_PER_DAY = 10;
const WORD_DAYS_PER_WEEK = 6;
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
  /** Extra off days (`YYYY-MM-DD`), studied like a Friday. */
  holidays?: readonly string[];
  /** Study cycles on a holiday falling on each weekday (defaults to capacityByWeekday). */
  holidayCapacityByWeekday?: readonly number[];
  /** In study order; the daily subject (vocabulary) may appear anywhere. */
  subjects: readonly PlanSubject[];
  today: string;
  /** Study cycles already completed today (any subject). */
  doneToday: number;
  /**
   * Lectures studied today (ticked done, or worked on with the old timer).
   * They use up today's lecture allowance, so ticking a lecture never makes
   * room for an extra one.
   */
  lecturesDoneToday?: number;
  /** A cycle on the daily subject was already completed today. */
  dailyDoneToday: boolean;
  /** Word days (non-Friday days with a vocabulary cycle) already done, today included. */
  vocabDaysDone: number;
  /**
   * Revision days by subject, in order (subject ids). When given, revision day N
   * goes wholly to its block's subjects (no mock test); days past the plan fall
   * back to rotating revision with mock tests.
   */
  revisionPlan?: readonly { subjectIds: readonly string[]; days: number }[];
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
  /** Days between the projected and planned learning end: positive = spare, negative = late. */
  bufferDays: number;
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

/** The revision-plan block covering revision day `n` (1-based), if any. */
function revisionBlock(plan: ScheduleInput["revisionPlan"], n: number) {
  let end = 0;
  for (const block of plan ?? []) {
    end += block.days;
    if (n <= end) return block.subjectIds.length > 0 ? block : undefined;
  }
  return undefined;
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
  const holidays = new Set(input.holidays ?? []);
  const mockDone = new Set(input.mockDays);

  const daily = subjects.find((s) => s.isDaily);
  const study = subjects.filter((s) => !s.isDaily);
  const queue = learningQueue(subjects);
  const remainingLearningCycles = queue.reduce((n, w) => n + w.cycles, 0);

  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const days: PlanDay[] = [];
  let projectedLearningEnd: string | null = null;
  let revisionTurn = 0;
  let wordDays = input.vocabDaysDone;

  for (let day = from; ; day = addDays(day, 1)) {
    const index = Math.round((Date.parse(day) - Date.parse(startDay)) / 86_400_000) + 1;
    const phase = phaseOf(index, learningDays, revisionDays);
    if (
      phase === "overflow" &&
      (queue.length === 0 || index > learningDays + revisionDays + MAX_OVERFLOW_DAYS)
    )
      break;

    const weekday = weekdayOf(day);
    const holiday = holidays.has(day) && weekday !== FRIDAY;
    const fullCapacity =
      (holiday ? input.holidayCapacityByWeekday : input.capacityByWeekday)?.[weekday] ??
      input.capacityByWeekday[weekday] ??
      0;
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

    // Daily subject (vocabulary) first, every day of the plan: 10 new words
    // Saturday–Thursday, and a revision of the week's words on Friday.
    if (daily && !(isToday && input.dailyDoneToday)) {
      if (weekday === FRIDAY) {
        take({
          kind: "daily",
          cycles: DAILY_CYCLES,
          label: `Vocabulary revision: this week's ${WORD_DAYS_PER_WEEK * WORDS_PER_DAY} words`,
          subjectId: daily.id,
        });
      } else {
        const topic = nextDailyTopic(daily);
        const first = wordDays * WORDS_PER_DAY + 1;
        take({
          kind: "daily",
          cycles: DAILY_CYCLES,
          label: `Words ${first}–${first + WORDS_PER_DAY - 1} · ${topic ? topic.title : daily.name}`,
          subjectId: daily.id,
          topicId: topic?.id,
        });
        wordDays += 1;
      }
    }

    // Friday reservations (learning phase only; revision days have their own shape).
    const fridayReserve =
      phase === "learning" && weekday === FRIDAY && !weeklyDone.has(day)
        ? WEEKLY_REVISION_CYCLES + WEEKLY_EXAM_CYCLES
        : 0;
    const block =
      phase === "revision" ? revisionBlock(input.revisionPlan, index - learningDays) : undefined;
    const mockDay = phase === "revision" && !block && (index - learningDays) % 2 === 0;
    const mockReserve = mockDay && !mockDone.has(day) ? MOCK_CYCLES : 0;
    const reserve = Math.min(free, fridayReserve + mockReserve);
    free -= reserve;

    // Learning work: always first in line, even after the learning phase (overflow).
    // Lectures are capped per day; a subject's revision + final get a day of their own.
    // The cap counts lectures, not cycles: a lecture with little left still counts as one.
    const lectureCap = weekday === FRIDAY || holiday ? HOLIDAY_LECTURES : LECTURES_PER_DAY;
    const doneLectures = isToday ? (input.lecturesDoneToday ?? 0) : 0;
    let lectureLeft = Math.max(0, lectureCap - doneLectures);
    let lecturedOn: string | undefined;
    let finalDay = false;
    while (free > 0 && queue.length > 0) {
      const head = queue[0];
      let used: number;
      if (head.kind === "topic") {
        if (finalDay || lectureLeft <= 0) break;
        used = take(head);
        lectureLeft -= 1;
        lecturedOn = head.subjectId;
      } else {
        if (lecturedOn !== undefined) break;
        used = take(head);
        finalDay = true;
      }
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

    // The rest of a lecture day's session revises the subject being covered.
    const reviseId = lecturedOn ?? queue[0]?.subjectId;
    if (!finalDay && phase !== "revision" && queue.length > 0 && reviseId && free > 0) {
      take({
        kind: "revision",
        cycles: free,
        label: `Revise ${subjectName.get(reviseId) ?? "covered lectures"}`,
        subjectId: reviseId,
      });
    }

    // Revision phase by subject: the day is split evenly between the block's subjects.
    if (!finalDay && block && free > 0) {
      const ids = block.subjectIds;
      const share = Math.floor(free / ids.length);
      const extra = free % ids.length;
      ids.forEach((id, i) =>
        take({
          kind: "revision",
          cycles: share + (i < extra ? 1 : 0),
          label: `Revise ${subjectName.get(id) ?? "subject"}`,
          subjectId: id,
        }),
      );
    }

    // Revision phase (or learning finished early): rotate through subjects in blocks.
    if (!finalDay && (phase === "revision" || queue.length === 0) && study.length > 0) {
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
    bufferDays: Math.round(
      (Date.parse(learningEnd) - Date.parse(projectedLearningEnd ?? addDays(from, -1))) /
        86_400_000,
    ),
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
export function cycleLabels<T extends PlanItem>(items: readonly T[]): T[] {
  return items.flatMap((item) =>
    Array.from({ length: item.cycles }, () => ({ ...item, cycles: 1 })),
  );
}

export type SubjectRoutineDay = {
  day: string;
  index: number;
  phase: Phase;
  items: PlanItem[];
};

const SUBJECT_KINDS: ReadonlySet<ItemKind> = new Set([
  "topic",
  "subject-revision",
  "subject-final",
  "revision",
]);

/** One subject's slice of the schedule: the days it is studied and what on each. */
export function subjectRoutine(days: readonly PlanDay[], subjectId: string): SubjectRoutineDay[] {
  const out: SubjectRoutineDay[] = [];
  for (const d of days) {
    const items = d.items.filter((i) => i.subjectId === subjectId && SUBJECT_KINDS.has(i.kind));
    if (items.length > 0) out.push({ day: d.day, index: d.index, phase: d.phase, items });
  }
  return out;
}

/** Day each lecture is planned to be finished on: the last plan day it appears on. */
export function topicFinishDays(days: readonly PlanDay[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of days) {
    for (const i of d.items) if (i.kind === "topic" && i.topicId) out.set(i.topicId, d.day);
  }
  return out;
}
