import type { CurrentUser } from "@/lib/auth";
import { addDays, startOfWeekKey } from "@/lib/planner";
import { prisma } from "@/lib/prisma";
import {
  EXAM_SPEC,
  coveredLectures,
  deadlineOf,
  parseRecords,
  pickQuestions,
  questionHistory,
  type AnswerRecord,
  type CoverageTopic,
  type LectureRef,
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

async function planTopics(planId: string, timezone: string): Promise<CoverageTopic[]> {
  const topics = await prisma.topic.findMany({
    where: { subject: { planId, isDaily: false } },
    select: { title: true, doneAt: true, subject: { select: { name: true } } },
  });
  return topics.map((t) => ({
    subject: t.subject.name,
    lecture: t.title,
    doneDay: t.doneAt ? studyDayKeyOf(t.doneAt, timezone) : null,
  }));
}

const keyOf = (l: LectureRef) => `${l.subject}\u0000${l.lecture}`;

export type ExamChoice = {
  kind: TakenExamKind;
  subjectId: string | null;
  label: string;
  /** Lectures the exam covers. */
  lectures: number;
  /** Questions in the bank for those lectures. */
  available: number;
  /** Questions the exam will ask. */
  questions: number;
  minutes: number;
};

export type ExamChoices = {
  daily: ExamChoice;
  weekly: ExamChoice;
  finals: ExamChoice[];
  /** Question-bank size, all subjects. */
  bankSize: number;
  inProgress: { id: string; kind: ExamKind; deadline: string } | null;
};

/** What can be taken now, and how many questions each exam would have. */
export async function getExamChoices(
  user: CurrentUser,
  plan: { id: string; subjects: { id: string; name: string; isDaily: boolean }[] },
  at = new Date(),
): Promise<ExamChoices> {
  const scope = examScope(user, at);
  const [topics, counts, open] = await Promise.all([
    planTopics(plan.id, user.timezone),
    prisma.question.groupBy({
      by: ["subject", "lecture"],
      where: visibleTo(user.id),
      _count: { _all: true },
    }),
    prisma.studyExam.findFirst({
      where: { planId: plan.id, startedAt: { not: null }, submittedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true, kind: true, startedAt: true, durationSec: true },
    }),
  ]);
  const perLecture = new Map(counts.map((c) => [keyOf(c), c._count._all]));
  const choice = (
    kind: TakenExamKind,
    label: string,
    subject?: { id: string; name: string },
  ): ExamChoice => {
    const lectures = coveredLectures(kind, topics, { ...scope, subject: subject?.name });
    const available = lectures.reduce((n, l) => n + (perLecture.get(keyOf(l)) ?? 0), 0);
    const spec = EXAM_SPEC[kind];
    return {
      kind,
      subjectId: subject?.id ?? null,
      label,
      lectures: lectures.length,
      available,
      questions: Math.min(available, spec.questions),
      minutes: spec.minutes,
    };
  };
  return {
    daily: choice("DAILY", "Daily exam"),
    weekly: choice("WEEKLY", "Weekly exam"),
    finals: plan.subjects
      .filter((s) => !s.isDaily)
      .map((s) => choice("SUBJECT_FINAL", `${s.name} final`, s)),
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

/** The question ids for a new exam: covered lectures, unseen first, then missed ones. */
export async function pickExamQuestions(
  user: CurrentUser,
  planId: string,
  kind: TakenExamKind,
  subjectName: string | undefined,
  at = new Date(),
): Promise<string[]> {
  const topics = await planTopics(planId, user.timezone);
  const lectures = coveredLectures(kind, topics, { ...examScope(user, at), subject: subjectName });
  if (lectures.length === 0) return [];
  const bySubject = new Map<string, string[]>();
  for (const l of lectures) {
    bySubject.set(l.subject, [...(bySubject.get(l.subject) ?? []), l.lecture]);
  }

  const [pool, past] = await Promise.all([
    prisma.question.findMany({
      where: {
        AND: [
          visibleTo(user.id),
          {
            OR: [...bySubject].map(([subject, titles]) => ({ subject, lecture: { in: titles } })),
          },
        ],
      },
      select: { id: true, answer: true },
    }),
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
  /** Only once the exam is submitted. */
  answer: number | null;
  explanation: string | null;
  source: string | null;
};

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
