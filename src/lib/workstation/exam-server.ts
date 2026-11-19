import type { CurrentUser } from "@/lib/auth";
import { addDays, startOfWeekKey } from "@/lib/planner";
import { prisma } from "@/lib/prisma";
import {
  EXAM_SPEC,
  deadlineOf,
  examStats,
  parseRecords,
  pickQuestions,
  questionHistory,
  type AnswerRecord,
  type ExamStats,
  type LectureRef,
  type QuestionInfo,
  type TakenExamKind,
} from "@/lib/workstation/exam";
import { localNow, studyDayKeyOf } from "@/lib/workstation/routine";
import type { ExamKind } from "@/schemas/workstation";

/** Questions visible to a user: the shared bank plus any of their own. */
const visibleTo = (userId: string) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

/** The current study day and its week, in the user's timezone. */
export function examScope(user: CurrentUser, at = new Date()) {
  const today = localNow(at, user.timezone).dayKey;
  const weekStart = startOfWeekKey(today, user.weekStartsOn);
  return { today, week: Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) };
}

type PlanTopic = LectureRef & { id: string; subjectId: string; doneDay: string | null };

async function planTopics(planId: string, timezone: string): Promise<PlanTopic[]> {
  const topics = await prisma.topic.findMany({
    where: { subject: { planId, isDaily: false } },
    orderBy: [{ subject: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      title: true,
      doneAt: true,
      subject: { select: { id: true, name: true } },
    },
  });
  return topics.map((t) => ({
    id: t.id,
    subjectId: t.subject.id,
    subject: t.subject.name,
    lecture: t.title,
    doneDay: t.doneAt ? studyDayKeyOf(t.doneAt, timezone) : null,
  }));
}

const keyOf = (l: LectureRef) => `${l.subject}\u0000${l.lecture}`;

/** A lecture that has questions in the bank, as offered in the topic pickers. */
export type TopicChoice = {
  id: string;
  subject: string;
  lecture: string;
  questions: number;
  done: boolean;
  doneToday: boolean;
  doneThisWeek: boolean;
};

export type FinalChoice = {
  subjectId: string;
  subject: string;
  lectures: number;
  available: number;
  questions: number;
  minutes: number;
};

export type ExamChoices = {
  topics: TopicChoice[];
  finals: FinalChoice[];
  /** Question-bank size, all subjects. */
  bankSize: number;
  inProgress: { id: string; kind: ExamKind; deadline: string } | null;
};

/** What can be taken now: lectures with questions (for daily, weekly and practice) and finals. */
export async function getExamChoices(
  user: CurrentUser,
  planId: string,
  at = new Date(),
): Promise<ExamChoices> {
  const scope = examScope(user, at);
  const week = new Set(scope.week);
  const [topics, counts, open] = await Promise.all([
    planTopics(planId, user.timezone),
    prisma.question.groupBy({
      by: ["subject", "lecture"],
      where: visibleTo(user.id),
      _count: { _all: true },
    }),
    prisma.studyExam.findFirst({
      where: { planId, startedAt: { not: null }, submittedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true, kind: true, startedAt: true, durationSec: true },
    }),
  ]);
  const perLecture = new Map(counts.map((c) => [keyOf(c), c._count._all]));

  const finals = new Map<string, FinalChoice>();
  for (const t of topics) {
    const f = finals.get(t.subjectId) ?? {
      subjectId: t.subjectId,
      subject: t.subject,
      lectures: 0,
      available: 0,
      questions: 0,
      minutes: EXAM_SPEC.SUBJECT_FINAL.minutes,
    };
    f.lectures += 1;
    f.available += perLecture.get(keyOf(t)) ?? 0;
    f.questions = Math.min(f.available, EXAM_SPEC.SUBJECT_FINAL.questions);
    finals.set(t.subjectId, f);
  }

  return {
    topics: topics
      .filter((t) => (perLecture.get(keyOf(t)) ?? 0) > 0)
      .map((t) => ({
        id: t.id,
        subject: t.subject,
        lecture: t.lecture,
        questions: perLecture.get(keyOf(t)) ?? 0,
        done: t.doneDay !== null,
        doneToday: t.doneDay === scope.today,
        doneThisWeek: t.doneDay !== null && week.has(t.doneDay),
      })),
    finals: [...finals.values()],
    bankSize: counts.reduce((n, c) => n + c._count._all, 0),
    inProgress:
      open?.startedAt && open.durationSec
        ? {
            id: open.id,
            kind: open.kind as ExamKind,
            deadline: deadlineOf(open.startedAt, open.durationSec).toISOString(),
          }
        : null,
  };
}

/** The plan's lectures by id (only the given ids that belong to the plan). */
export async function lecturesOf(user: CurrentUser, planId: string, topicIds: readonly string[]) {
  const wanted = new Set(topicIds);
  return (await planTopics(planId, user.timezone)).filter((t) => wanted.has(t.id));
}

async function poolFor(userId: string, lectures: readonly LectureRef[]) {
  if (lectures.length === 0) return [];
  const bySubject = new Map<string, string[]>();
  for (const l of lectures) {
    bySubject.set(l.subject, [...(bySubject.get(l.subject) ?? []), l.lecture]);
  }
  return prisma.question.findMany({
    where: {
      AND: [
        visibleTo(userId),
        { OR: [...bySubject].map(([subject, titles]) => ({ subject, lecture: { in: titles } })) },
      ],
    },
  });
}

/**
 * The question ids for a new exam: the chosen lectures (or all of a subject's
 * for a final), never-seen questions first, then ones missed last time.
 */
export async function pickExamQuestions(
  user: CurrentUser,
  planId: string,
  kind: TakenExamKind,
  lectures: readonly LectureRef[],
): Promise<string[]> {
  const [pool, past] = await Promise.all([
    poolFor(user.id, lectures),
    prisma.studyExam.findMany({
      where: { planId, submittedAt: { not: null } },
      select: { submittedAt: true, questions: true },
    }),
  ]);
  const answers = new Map(pool.map((q) => [q.id, q.answer]));
  const history = questionHistory(
    past.map((e) => ({ submittedAt: e.submittedAt, records: parseRecords(e.questions) ?? [] })),
    (id) => answers.get(id),
  );
  return pickQuestions(
    pool.map((q) => q.id),
    history,
    EXAM_SPEC[kind].questions,
  );
}

export type ExamQuestion = {
  id: string;
  text: string;
  options: string[];
  section: string;
  lecture: string;
  /** Only once the exam is submitted (always for practice). */
  answer: number | null;
  explanation: string | null;
  source: string | null;
};

/** Random questions from the chosen lectures, with answers: practice is checked as you go. */
export async function getPracticeQuestions(
  user: CurrentUser,
  lectures: readonly LectureRef[],
  count: number,
): Promise<ExamQuestion[]> {
  const pool = await poolFor(user.id, lectures);
  const byId = new Map(pool.map((q) => [q.id, q]));
  return pickQuestions(
    pool.map((q) => q.id),
    new Map(),
    count,
  ).map((id) => {
    const q = byId.get(id)!;
    return {
      id: q.id,
      text: q.text,
      options: q.options,
      section: q.section,
      lecture: q.lecture,
      answer: q.answer,
      explanation: q.explanation,
      source: q.source,
    };
  });
}

export type ExamSheet = {
  id: string;
  kind: ExamKind;
  subjectName: string | null;
  day: string;
  startedAt: string;
  deadline: string;
  submittedAt: string | null;
  score: number | null;
  records: AnswerRecord[];
  questions: ExamQuestion[];
};

/** An exam taken in the app, owned by the user; answers are left out until it is submitted. */
export async function getExamSheet(user: CurrentUser, examId: string): Promise<ExamSheet | null> {
  const exam = await prisma.studyExam.findFirst({
    where: { id: examId, plan: { userId: user.id } },
    include: { subject: { select: { name: true } } },
  });
  const records = parseRecords(exam?.questions);
  if (!exam || !records || !exam.startedAt || !exam.durationSec) return null;

  const rows = await prisma.question.findMany({
    where: { id: { in: records.map((r) => r.id) } },
  });
  const byId = new Map(rows.map((q) => [q.id, q]));
  const submitted = exam.submittedAt !== null;
  return {
    id: exam.id,
    kind: exam.kind as ExamKind,
    subjectName: exam.subject?.name ?? null,
    day: exam.day,
    startedAt: exam.startedAt.toISOString(),
    deadline: deadlineOf(exam.startedAt, exam.durationSec).toISOString(),
    submittedAt: exam.submittedAt?.toISOString() ?? null,
    score: exam.score,
    records,
    questions: records.flatMap((r) => {
      const q = byId.get(r.id);
      if (!q) return [];
      return [
        {
          id: q.id,
          text: q.text,
          options: q.options,
          section: q.section,
          lecture: q.lecture,
          answer: submitted ? q.answer : null,
          explanation: submitted ? q.explanation : null,
          source: q.source,
        },
      ];
    }),
  };
}

/** Real exam results for the dashboard (exams still running are left out). */
export async function getExamStats(user: CurrentUser): Promise<ExamStats | null> {
  const plan = await prisma.studyPlan.findUnique({
    where: { userId: user.id },
    select: {
      exams: {
        where: { OR: [{ startedAt: null }, { submittedAt: { not: null } }] },
        select: {
          id: true,
          kind: true,
          day: true,
          score: true,
          total: true,
          questions: true,
          createdAt: true,
        },
      },
    },
  });
  if (!plan) return null;
  const exams = plan.exams.map((e) => ({
    id: e.id,
    kind: e.kind,
    day: e.day,
    at: e.createdAt,
    score: e.score,
    total: e.total,
    records: parseRecords(e.questions),
  }));
  const ids = [...new Set(exams.flatMap((e) => (e.records ?? []).map((r) => r.id)))];
  const questions = ids.length
    ? await prisma.question.findMany({
        where: { id: { in: ids } },
        select: { id: true, answer: true, section: true, lecture: true },
      })
    : [];
  const info = new Map<string, QuestionInfo>(questions.map((q) => [q.id, q]));
  return examStats(exams, info);
}
