/**
 * Today's study list, ticked by hand (there is no study timer). Each item of
 * the day's plan is done when:
 * - a lecture: the lecture is ticked done (Topic.doneAt);
 * - an exam (weekly, subject final, mock): a result is recorded that day;
 * - anything else (vocabulary, revision): a StudyCheck row exists for its key.
 */
import type { ItemKind, PlanItem } from "@/lib/workstation/schedule";

export type TodayItem = PlanItem & {
  /** Stable key of the item within its day (StudyCheck.key for checked items). */
  key: string;
  done: boolean;
  /** How the item is ticked. */
  via: "topic" | "exam" | "check";
};

export type ExamDone = { kind: "WEEKLY" | "SUBJECT_FINAL" | "MOCK"; subjectId: string | null };

const EXAM_OF: Partial<Record<ItemKind, ExamDone["kind"]>> = {
  "weekly-exam": "WEEKLY",
  "subject-final": "SUBJECT_FINAL",
  mock: "MOCK",
};

/** Study cycles a recorded exam stands for (daily exams are extra, not planned). */
export const EXAM_CYCLES: Record<string, number> = { WEEKLY: 1, SUBJECT_FINAL: 1, MOCK: 3 };

/**
 * Keys for the items of one day: `kind:subjectId:n`, n counting repeats of the
 * same kind and subject that day (lectures are keyed by topic id).
 */
export function itemKeys(items: readonly PlanItem[]): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    if (item.kind === "topic" && item.topicId) return `topic:${item.topicId}`;
    const base = `${item.kind}:${item.subjectId ?? ""}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}:${n}`;
  });
}

export function todayItems(
  items: readonly PlanItem[],
  state: {
    doneTopicIds: ReadonlySet<string>;
    checkedKeys: ReadonlySet<string>;
    examsToday: readonly ExamDone[];
  },
): TodayItem[] {
  const keys = itemKeys(items);
  return items.map((item, i) => {
    const key = keys[i];
    if (item.kind === "topic" && item.topicId) {
      return { ...item, key, via: "topic", done: state.doneTopicIds.has(item.topicId) };
    }
    const exam = EXAM_OF[item.kind];
    if (exam) {
      const done = state.examsToday.some(
        (e) => e.kind === exam && (exam !== "SUBJECT_FINAL" || e.subjectId === item.subjectId),
      );
      return { ...item, key, via: "exam", done };
    }
    return { ...item, key, via: "check", done: state.checkedKeys.has(key) };
  });
}

/** Cycles of the items done, out of all of today's items. */
export function todayProgress(items: readonly TodayItem[]) {
  const total = items.reduce((n, i) => n + i.cycles, 0);
  const done = items.filter((i) => i.done).reduce((n, i) => n + i.cycles, 0);
  return { done, total, complete: items.length > 0 && items.every((i) => i.done) };
}
