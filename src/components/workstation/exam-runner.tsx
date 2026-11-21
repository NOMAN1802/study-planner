"use client";

import { Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { submitExam } from "@/actions/exam";
import { Button } from "@/components/ui/button";
import { OPTION_LETTERS } from "@/lib/workstation/exam";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

export type RunnerQuestion = { id: string; text: string; options: string[]; section: string };

type Answers = Record<string, number>;

const storageKey = (examId: string) => `ws-exam:${examId}`;

function loadAnswers(examId: string): Answers {
  try {
    const raw = window.localStorage.getItem(storageKey(examId));
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (typeof value !== "object" || value === null) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => Number.isInteger(v) && v >= 0 && v <= 3),
    ) as Answers;
  } catch {
    return {};
  }
}

function saveAnswers(examId: string, answers: Answers | null) {
  try {
    if (answers) window.localStorage.setItem(storageKey(examId), JSON.stringify(answers));
    else window.localStorage.removeItem(storageKey(examId));
  } catch {
    // Private mode or storage full: answers stay in memory only.
  }
}

function formatLeft(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Runs an exam: one A–D choice per question, a countdown from the server's
 * deadline (corrected for this device's clock), answers kept in this browser
 * so a reload loses nothing, and an automatic submit when time is up.
 */
export function ExamRunner({
  examId,
  title,
  deadline,
  serverNow,
  questions,
}: {
  examId: string;
  title: string;
  deadline: string;
  serverNow: string;
  questions: RunnerQuestion[];
}) {
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [answers, setAnswers] = useState<Answers>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sent = useRef(false);
  const now = useNow(1000);
  const left = Date.parse(deadline) - (now + offset);
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore once from this browser's storage
    setAnswers(loadAnswers(examId));
  }, [examId]);

  const submit = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    setConfirming(false);
    startTransition(async () => {
      const result = await submitExam(examId, answers);
      if (result.error) {
        sent.current = false;
        setError(result.error);
      } else {
        saveAnswers(examId, null);
      }
    });
  }, [answers, examId]);

  useEffect(() => {
    if (left <= 0) submit();
  }, [left, submit]);

  const choose = (questionId: string, option: number) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: option };
      saveAnswers(examId, next);
      return next;
    });
  };

  const unanswered = questions.length - answered;
  const timeUp = left <= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h2 className="font-display text-base font-medium tracking-tight">{title}</h2>
          <p className="text-xs text-fg-muted" data-testid="exam-progress">
            {answered}/{questions.length} answered · +1 correct, −0.5 wrong, 0 blank
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            role="timer"
            aria-label="Time left"
            data-testid="exam-timer"
            className={cn(
              "inline-flex items-center gap-2 font-mono text-lg tabular-nums",
              left < 60_000 ? "text-danger" : left < 5 * 60_000 ? "text-warning" : "text-fg",
            )}
          >
            <Clock className="size-4" aria-hidden />
            {formatLeft(left)}
          </span>
          {confirming ? (
            <span className="flex items-center gap-2">
              <span className="text-xs text-fg-muted">{unanswered} left blank. Submit?</span>
              <Button size="sm" onClick={submit} loading={pending}>
                Submit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Keep going
              </Button>
            </span>
          ) : (
            <Button
              size="sm"
              loading={pending}
              disabled={timeUp && !error}
              onClick={() => (unanswered > 0 ? setConfirming(true) : submit())}
            >
              Submit answers
            </Button>
          )}
        </div>
      </div>

      <p role="status" className="sr-only">
        {timeUp ? "Time is up. Your answers are being submitted." : ""}
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-sm border border-danger/40 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={q.id}>
            <fieldset
              className="rounded-sm border border-border bg-surface p-4"
              data-testid="exam-question"
              disabled={pending || (timeUp && !error)}
            >
              <legend className="sr-only">Question {i + 1}</legend>
              <p className="mb-3 text-sm font-medium">
                <span className="mr-2 font-mono text-fg-muted tabular-nums">{i + 1}.</span>
                {q.text}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((option, j) => {
                  const checked = answers[q.id] === j;
                  return (
                    <label
                      key={j}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-sm border px-3 py-2 text-sm transition-colors",
                        checked
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-border-strong",
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={j}
                        checked={checked}
                        onChange={() => choose(q.id, j)}
                        className="mt-0.5 accent-[var(--color-accent)]"
                      />
                      <span>
                        <span className="mr-1 font-mono text-fg-muted">{OPTION_LETTERS[j]}.</span>
                        {option}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="flex justify-end">
        <Button
          loading={pending}
          disabled={timeUp && !error}
          onClick={() => (unanswered > 0 ? setConfirming(true) : submit())}
        >
          Submit answers
        </Button>
      </div>
    </div>
  );
}
