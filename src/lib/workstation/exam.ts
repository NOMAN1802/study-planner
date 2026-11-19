/**
 * Question-bank exams taken in the app (BCS Preliminary standard). Pure rules:
 * exam sizes, which lectures an exam covers, which questions to ask, marking.
 *
 * | Exam          | Questions | Time   | Drawn from                     |
 * | Daily         | 20        | 15 min | lectures ticked done today     |
 * | Weekly        | 50        | 30 min | lectures ticked done this week |
 * | Subject final | 100       | 60 min | every lecture of the subject   |
 *
 * Marking: +1 correct, −0.5 wrong, 0 unanswered (totals can be negative).
 * Questions not seen before come first, then ones last answered wrong, then the rest.
 */

export const TAKEN_EXAM_KINDS = ["DAILY", "WEEKLY", "SUBJECT_FINAL"] as const;
export type TakenExamKind = (typeof TAKEN_EXAM_KINDS)[number];

export const EXAM_SPEC: Record<TakenExamKind, { questions: number; minutes: number }> = {
  DAILY: { questions: 20, minutes: 15 },
  WEEKLY: { questions: 50, minutes: 30 },
  SUBJECT_FINAL: { questions: 100, minutes: 60 },
};

export const MARK_CORRECT = 1;
export const MARK_WRONG = -0.5;
/** An answer sheet sent this long after the time is up still counts (slow networks). */
export const SUBMIT_GRACE_MS = 2 * 60_000;

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

/** One question of an exam as stored: its id and the option chosen (0–3), if any. */
export type AnswerRecord = { id: string; chosen: number | null };

const isChoice = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 3;

/** The answer records stored on an exam row (JSON), or null when there are none. */
export function parseRecords(value: unknown): AnswerRecord[] | null {
  if (!Array.isArray(value)) return null;
  const out: AnswerRecord[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null) return null;
    const { id, chosen } = v as { id?: unknown; chosen?: unknown };
    if (typeof id !== "string") return null;
    out.push({ id, chosen: isChoice(chosen) ? chosen : null });
  }
  return out;
}

/** Applies a submitted answer sheet (question id → option) to the exam's questions. */
export function applyAnswers(
  records: readonly AnswerRecord[],
  answers: Readonly<Record<string, unknown>>,
): AnswerRecord[] {
  return records.map((r) => {
    const chosen = answers[r.id];
    return { id: r.id, chosen: isChoice(chosen) ? chosen : null };
  });
}

export type Marking = {
  score: number;
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
};

export function markExam(
  records: readonly AnswerRecord[],
  answerOf: (id: string) => number | undefined,
): Marking {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  for (const r of records) {
    if (r.chosen === null) unanswered += 1;
    else if (r.chosen === answerOf(r.id)) correct += 1;
    else wrong += 1;
  }
  return {
    score: correct * MARK_CORRECT + wrong * MARK_WRONG,
    correct,
    wrong,
    unanswered,
    total: records.length,
  };
}

/** Whether each question was answered correctly the last time it was asked. */
export type QuestionHistory = Map<string, { lastCorrect: boolean }>;

export function questionHistory(
  exams: readonly { submittedAt: Date | null; records: readonly AnswerRecord[] }[],
  answerOf: (id: string) => number | undefined,
): QuestionHistory {
  const history: QuestionHistory = new Map();
  const submitted = exams
    .filter((e): e is { submittedAt: Date; records: readonly AnswerRecord[] } => !!e.submittedAt)
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  for (const exam of submitted) {
    for (const r of exam.records) {
      history.set(r.id, { lastCorrect: r.chosen !== null && r.chosen === answerOf(r.id) });
    }
  }
  return history;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks up to `count` question ids from the pool: never-seen questions first,
 * then ones answered wrong (or left blank) last time, then the rest — each
 * group in random order.
 */
export function pickQuestions(
  pool: readonly string[],
  history: QuestionHistory,
  count: number,
  random: () => number = Math.random,
): string[] {
  const unseen: string[] = [];
  const wrong: string[] = [];
  const right: string[] = [];
  for (const id of new Set(pool)) {
    const h = history.get(id);
    if (!h) unseen.push(id);
    else if (!h.lastCorrect) wrong.push(id);
    else right.push(id);
  }
  return [...shuffle(unseen, random), ...shuffle(wrong, random), ...shuffle(right, random)].slice(
    0,
    Math.max(0, count),
  );
}

/** A lecture as the question bank names it: subject and lecture titles. */
export type LectureRef = { subject: string; lecture: string };

export type CoverageTopic = LectureRef & {
  /** Study day the lecture was ticked done, or null. */
  doneDay: string | null;
};

/** The lectures an exam covers. */
export function coveredLectures(
  kind: TakenExamKind,
  topics: readonly CoverageTopic[],
  scope: { today: string; week: readonly string[]; subject?: string },
): LectureRef[] {
  const week = new Set(scope.week);
  return topics
    .filter((t) => {
      if (kind === "DAILY") return t.doneDay === scope.today;
      if (kind === "WEEKLY") return t.doneDay !== null && week.has(t.doneDay);
      return t.subject === scope.subject;
    })
    .map(({ subject, lecture }) => ({ subject, lecture }));
}

/** When an exam's time is up. */
export function deadlineOf(startedAt: Date, durationSec: number): Date {
  return new Date(startedAt.getTime() + durationSec * 1000);
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
