import { Check, X } from "lucide-react";
import { Bar } from "@/components/workstation/ws-header";
import { OPTION_LETTERS, formatScore, markExam } from "@/lib/workstation/exam";
import type { ExamSheet } from "@/lib/workstation/exam-server";
import { cn } from "@/lib/utils";

/** A submitted exam: the marks, then every question with the right answer shown. */
export function ExamReview({ sheet, title }: { sheet: ExamSheet; title: string }) {
  const answerOf = new Map(sheet.questions.map((q) => [q.id, q.answer ?? undefined]));
  const marking = markExam(sheet.records, (id) => answerOf.get(id));
  const chosen = new Map(sheet.records.map((r) => [r.id, r.chosen]));
  const pct =
    marking.total > 0 ? Math.round((Math.max(0, marking.score) / marking.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="result-title"
        className="rounded-sm border border-border bg-surface p-4 sm:p-5"
      >
        <h2 id="result-title" className="font-display text-base font-medium tracking-tight">
          {title} · result
        </h2>
        <p className="mt-2 font-mono text-3xl tabular-nums" data-testid="exam-result-score">
          {formatScore(marking.score)}
          <span className="text-base text-fg-muted">/{marking.total}</span>
          <span className="ml-2 text-base text-fg-muted">{pct}%</span>
        </p>
        <div className="mt-2 max-w-sm">
          <Bar value={pct} max={100} />
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-fg-muted">Correct</dt>
            <dd className="font-mono tabular-nums" data-testid="exam-result-correct">
              {marking.correct}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-fg-muted">Wrong (−0.5 each)</dt>
            <dd className="font-mono tabular-nums">{marking.wrong}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-fg-muted">Unanswered</dt>
            <dd className="font-mono tabular-nums">{marking.unanswered}</dd>
          </div>
        </dl>
      </section>

      <ol className="flex flex-col gap-3" aria-label="Answers">
        {sheet.questions.map((q, i) => {
          const mine = chosen.get(q.id) ?? null;
          const right = mine !== null && mine === q.answer;
          return (
            <li
              key={q.id}
              className="rounded-sm border border-border bg-surface p-4"
              data-testid="exam-review-question"
            >
              <p className="mb-3 flex items-start gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                    mine === null
                      ? "bg-surface-2 text-fg-muted"
                      : right
                        ? "bg-accent/15 text-accent"
                        : "bg-danger/15 text-danger",
                  )}
                  aria-label={mine === null ? "Unanswered" : right ? "Correct" : "Wrong"}
                >
                  {mine === null ? (
                    "–"
                  ) : right ? (
                    <Check className="size-3.5" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </span>
                <span>
                  <span className="mr-2 font-mono text-fg-muted tabular-nums">{i + 1}.</span>
                  {q.text}
                </span>
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {q.options.map((option, j) => {
                  const isAnswer = j === q.answer;
                  const isMine = j === mine;
                  return (
                    <li
                      key={j}
                      className={cn(
                        "rounded-sm border px-3 py-1.5 text-sm",
                        isAnswer
                          ? "border-accent bg-accent/10"
                          : isMine
                            ? "border-danger bg-danger/10"
                            : "border-border text-fg-muted",
                      )}
                    >
                      <span className="mr-1 font-mono">{OPTION_LETTERS[j]}.</span>
                      {option}
                      {isAnswer ? <span className="sr-only"> (correct answer)</span> : null}
                      {isMine && !isAnswer ? <span className="sr-only"> (your answer)</span> : null}
                    </li>
                  );
                })}
              </ul>
              {q.explanation || q.source ? (
                <p className="mt-3 text-xs text-fg-muted">
                  {q.source ? <span className="mr-2 font-medium">[{q.source}]</span> : null}
                  {q.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
