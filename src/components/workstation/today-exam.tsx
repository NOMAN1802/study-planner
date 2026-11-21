"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { startExam, type StartExamState } from "@/actions/exam";
import { Button } from "@/components/ui/button";
import { secondaryLink } from "@/components/workstation/format";
import { EXAM_SPEC } from "@/lib/workstation/exam";
import type { ExamChoices } from "@/lib/workstation/exam-server";

/**
 * One-click daily exam on the lectures ticked done today (the same default as
 * the Exams tab, where other topics can be picked).
 */
export function TodayExam({ choices }: { choices: ExamChoices }) {
  const [state, action, pending] = useActionState<StartExamState, FormData>(startExam, {});
  const today = choices.topics.filter((t) => t.doneToday);
  const available = today.reduce((n, t) => n + t.questions, 0);
  const questions = Math.min(available, EXAM_SPEC.DAILY.questions);

  return (
    <section
      aria-labelledby="today-exam-title"
      className="enter flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3"
      data-testid="today-exam"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <ClipboardCheck className="size-4 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <h2 id="today-exam-title" className="text-sm font-medium">
            Today&apos;s exam
          </h2>
          <p className="text-xs text-fg-muted" data-testid="today-exam-summary">
            {choices.inProgress
              ? "An exam is still running"
              : questions > 0
                ? `${questions} questions · ${EXAM_SPEC.DAILY.minutes} min · from ${today.length} ${
                    today.length === 1 ? "lecture" : "lectures"
                  } done today`
                : "Tick today's lectures done (ones with questions in the bank) to unlock it"}
          </p>
        </div>
      </div>
      {choices.inProgress ? (
        <Link href={`/work-station/exam/${choices.inProgress.id}`} className={secondaryLink}>
          Continue exam
        </Link>
      ) : (
        <form action={action} className="flex flex-col items-end gap-1">
          <input type="hidden" name="kind" value="DAILY" />
          {today.map((t) => (
            <input key={t.id} type="hidden" name="topicId" value={t.id} />
          ))}
          <Button size="sm" type="submit" loading={pending} disabled={questions === 0}>
            Take today&apos;s exam
          </Button>
          {state.error ? (
            <p role="alert" className="text-xs text-danger">
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
