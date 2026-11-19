"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { startExam, type StartExamState } from "@/actions/exam";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ExamChoice, ExamChoices } from "@/lib/workstation/exam-server";
import { EXAM_LABEL } from "@/schemas/workstation";

function Summary({ choice, empty }: { choice: ExamChoice; empty: string }) {
  if (choice.questions === 0) return <p className="text-xs text-fg-muted">{empty}</p>;
  return (
    <p className="text-xs text-fg-muted">
      {choice.questions} questions · {choice.minutes} min · from {choice.lectures}{" "}
      {choice.lectures === 1 ? "lecture" : "lectures"}
      {choice.available > choice.questions ? ` (${choice.available} in the bank)` : ""}
    </p>
  );
}

function StartButton({ choice, label }: { choice: ExamChoice; label: string }) {
  const [state, action, pending] = useActionState<StartExamState, FormData>(startExam, {});
  return (
    <form action={action} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="kind" value={choice.kind} />
      {choice.subjectId ? <input type="hidden" name="subjectId" value={choice.subjectId} /> : null}
      <Button size="sm" type="submit" loading={pending} disabled={choice.questions === 0}>
        {label}
      </Button>
      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Start a daily, weekly or subject-final exam from the question bank. */
export function ExamStart({ choices }: { choices: ExamChoices }) {
  const firstWithQuestions = choices.finals.find((f) => f.questions > 0) ?? choices.finals[0];
  const [finalId, setFinalId] = useState(firstWithQuestions?.subjectId ?? "");
  const final = choices.finals.find((f) => f.subjectId === finalId) ?? firstWithQuestions;

  if (choices.inProgress) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Your {EXAM_LABEL[choices.inProgress.kind].toLowerCase()} is still running.
        </p>
        <Link
          href={`/work-station/exam/${choices.inProgress.id}`}
          className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] text-accent-fg hover:bg-accent-strong"
        >
          Continue exam
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {choices.bankSize === 0 ? (
        <p className="text-sm text-fg-muted">
          The question bank is empty. Load questions with{" "}
          <code className="font-mono text-xs">pnpm db:questions</code>.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2" data-testid="exam-start-daily">
          <h3 className="text-sm font-medium">Daily exam</h3>
          <Summary choice={choices.daily} empty="Tick today's lectures done to unlock it." />
          <StartButton choice={choices.daily} label="Start daily exam" />
        </div>
        <div className="flex flex-col gap-2" data-testid="exam-start-weekly">
          <h3 className="text-sm font-medium">Weekly exam</h3>
          <Summary choice={choices.weekly} empty="No questions yet for this week's lectures." />
          <StartButton choice={choices.weekly} label="Start weekly exam" />
        </div>
        {final ? (
          <div className="flex flex-col gap-2" data-testid="exam-start-final">
            <label htmlFor="exam-final-subject" className="text-sm font-medium">
              Subject final
            </label>
            <Select
              id="exam-final-subject"
              value={final.subjectId ?? ""}
              onChange={(e) => setFinalId(e.target.value)}
            >
              {choices.finals.map((f) => (
                <option key={f.subjectId} value={f.subjectId ?? ""}>
                  {f.label.replace(/ final$/, "")} ({f.available})
                </option>
              ))}
            </Select>
            <Summary choice={final} empty="No questions in the bank for this subject yet." />
            <StartButton key={final.subjectId} choice={final} label="Start subject final" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
