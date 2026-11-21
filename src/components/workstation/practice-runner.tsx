"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MARK_CORRECT, MARK_WRONG, OPTION_LETTERS, formatScore } from "@/lib/workstation/exam";
import { cn } from "@/lib/utils";

export type PracticeQuestion = {
  id: string;
  text: string;
  options: string[];
  answer: number;
  explanation: string | null;
  source: string | null;
  section: string;
};

/**
 * Practice: no timer, each answer is checked as soon as it is chosen (with the
 * explanation), and nothing is saved — results never reach Exams or the dashboard.
 */
export function PracticeRunner({
  questions,
  again,
}: {
  questions: PracticeQuestion[];
  /** Link to a fresh practice on the same topics. */
  again: string;
}) {
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const answered = questions.filter((q) => chosen[q.id] !== undefined);
  const correct = answered.filter((q) => chosen[q.id] === q.answer).length;
  const wrong = answered.length - correct;
  const finished = answered.length === questions.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3 shadow-sm">
        <div>
          <h2 className="font-display text-base font-medium tracking-tight">Practice</h2>
          <p className="text-xs text-fg-muted">No timer · not saved · checked as you go</p>
        </div>
        <p
          className="font-mono text-sm tabular-nums"
          data-testid="practice-tally"
          aria-live="polite"
        >
          <span className="text-accent">{correct} correct</span> ·{" "}
          <span className="text-danger">{wrong} wrong</span> · {questions.length - answered.length}{" "}
          left
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const mine = chosen[q.id];
          const done = mine !== undefined;
          return (
            <li key={q.id}>
              <fieldset
                className="rounded-sm border border-border bg-surface p-4"
                data-testid="practice-question"
              >
                <legend className="sr-only">Question {i + 1}</legend>
                <p className="mb-3 text-sm font-medium">
                  <span className="mr-2 font-mono text-fg-muted tabular-nums">{i + 1}.</span>
                  {q.text}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((option, j) => {
                    const isAnswer = j === q.answer;
                    const isMine = j === mine;
                    return (
                      <button
                        key={j}
                        type="button"
                        disabled={done}
                        aria-pressed={isMine}
                        onClick={() => setChosen((prev) => ({ ...prev, [q.id]: j }))}
                        className={cn(
                          "flex items-start gap-2 rounded-sm border px-3 py-2 text-left text-sm transition-colors",
                          !done && "border-border hover:border-border-strong",
                          done && isAnswer && "border-accent bg-accent/10",
                          done && isMine && !isAnswer && "border-danger bg-danger/10",
                          done && !isAnswer && !isMine && "border-border text-fg-muted",
                        )}
                      >
                        <span className="font-mono text-fg-muted">{OPTION_LETTERS[j]}.</span>
                        <span className="flex-1">{option}</span>
                        {done && isAnswer ? (
                          <Check
                            className="size-4 shrink-0 text-accent"
                            aria-label="Correct answer"
                          />
                        ) : null}
                        {done && isMine && !isAnswer ? (
                          <X className="size-4 shrink-0 text-danger" aria-label="Your answer" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {done ? (
                  <p
                    className={cn(
                      "mt-3 text-xs",
                      mine === q.answer ? "text-accent" : "text-danger",
                    )}
                    data-testid="practice-feedback"
                  >
                    <span className="font-medium">
                      {mine === q.answer
                        ? "Correct."
                        : `Wrong — the answer is ${OPTION_LETTERS[q.answer]}.`}
                    </span>{" "}
                    <span className="text-fg-muted">
                      {q.source ? `[${q.source}] ` : ""}
                      {q.explanation}
                    </span>
                  </p>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {finished ? (
        <section
          aria-labelledby="practice-done"
          className="rounded-sm border border-border bg-surface p-4"
          data-testid="practice-summary"
        >
          <h2 id="practice-done" className="text-sm font-medium">
            Practice finished
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {correct}/{questions.length} correct · would score{" "}
            {formatScore(correct * MARK_CORRECT + wrong * MARK_WRONG)} in a real exam. Not saved.
          </p>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href={again} className="font-medium text-accent hover:underline">
              New questions, same topics
            </Link>
            <Link href="/work-station/exams" className="text-fg-muted hover:text-fg">
              Back to exams
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
