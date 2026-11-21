"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { startExam, type StartExamState } from "@/actions/exam";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EXAM_SPEC } from "@/lib/workstation/exam";
import type { ExamChoices, TopicChoice } from "@/lib/workstation/exam-server";
import { cn } from "@/lib/utils";
import { EXAM_LABEL } from "@/schemas/workstation";

type Kind = "DAILY" | "WEEKLY";

const defaultsFor = (kind: Kind, topics: readonly TopicChoice[]) =>
  new Set(topics.filter((t) => (kind === "DAILY" ? t.doneToday : t.doneThisWeek)).map((t) => t.id));

/** A checklist of lectures, grouped by subject, posting `name` for each one ticked. */
function TopicPicker({
  name,
  topics,
  selected,
  onChange,
  label,
}: {
  name: string;
  topics: readonly TopicChoice[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  label: string;
}) {
  const id = useId();
  const subjects = [...new Set(topics.map((t) => t.subject))];
  const toggle = (topicId: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(topicId);
    else next.delete(topicId);
    onChange(next);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex w-full items-center justify-between text-xs text-fg-muted">
        <span>
          {label} · {selected.size} picked
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => onChange(new Set(topics.map((t) => t.id)))}
          >
            All
          </button>
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => onChange(new Set())}
          >
            None
          </button>
        </span>
      </legend>
      <div className="max-h-56 overflow-y-auto rounded-sm border border-border p-2">
        {subjects.map((subject) => (
          <div key={subject} className="mb-2 last:mb-0">
            <p className="px-1 text-xs font-medium text-fg-muted">{subject}</p>
            {topics
              .filter((t) => t.subject === subject)
              .map((t) => (
                <label
                  key={t.id}
                  htmlFor={`${id}-${t.id}`}
                  className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 text-sm hover:bg-surface-2"
                >
                  <input
                    id={`${id}-${t.id}`}
                    type="checkbox"
                    name={name}
                    value={t.id}
                    checked={selected.has(t.id)}
                    onChange={(e) => toggle(t.id, e.target.checked)}
                    className="mt-0.5 accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 flex-1">{t.lecture}</span>
                  <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                    {t.questions}
                  </span>
                </label>
              ))}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function ErrorText({ state }: { state: StartExamState }) {
  return state.error ? (
    <p role="alert" className="text-xs text-danger">
      {state.error}
    </p>
  ) : null;
}

/** Daily or weekly exam on the topics picked (default: today's / this week's done lectures). */
function TopicExam({ topics }: { topics: TopicChoice[] }) {
  const done = topics.filter((t) => t.done);
  const [kind, setKind] = useState<Kind>("DAILY");
  const [selected, setSelected] = useState(() => defaultsFor("DAILY", done));
  const [state, action, pending] = useActionState<StartExamState, FormData>(startExam, {});
  const spec = EXAM_SPEC[kind];
  const available = done.filter((t) => selected.has(t.id)).reduce((n, t) => n + t.questions, 0);
  const asks = Math.min(available, spec.questions);

  const pick = (next: Kind) => {
    setKind(next);
    setSelected(defaultsFor(next, done));
  };

  return (
    <form action={action} className="flex flex-col gap-3" data-testid="exam-start-topics">
      <input type="hidden" name="kind" value={kind} />
      <div
        role="radiogroup"
        aria-label="Exam"
        className="inline-flex self-start rounded-sm border border-border p-0.5"
      >
        {(["DAILY", "WEEKLY"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => pick(k)}
            className={cn(
              "inline-flex h-7 items-center rounded-sm px-3 text-sm transition-colors",
              kind === k ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {EXAM_LABEL[k]} · {EXAM_SPEC[k].questions} q
          </button>
        ))}
      </div>
      {done.length === 0 ? (
        <p className="text-xs text-fg-muted">
          Tick lectures done to unlock exams on them (only lectures with questions in the bank are
          listed).
        </p>
      ) : (
        <TopicPicker
          name="topicId"
          label="Topics you have studied"
          topics={done}
          selected={selected}
          onChange={setSelected}
        />
      )}
      <p className="text-xs text-fg-muted" data-testid="exam-start-summary">
        {asks > 0
          ? `${asks} questions · ${spec.minutes} min · real exam: marked and saved`
          : "Pick at least one topic"}
      </p>
      <div className="flex flex-col items-start gap-2">
        <Button size="sm" type="submit" loading={pending} disabled={asks === 0}>
          Start {EXAM_LABEL[kind].toLowerCase()}
        </Button>
        <ErrorText state={state} />
      </div>
    </form>
  );
}

function FinalExam({ finals }: { finals: ExamChoices["finals"] }) {
  const first = finals.find((f) => f.questions > 0) ?? finals[0];
  const [subjectId, setSubjectId] = useState(first?.subjectId ?? "");
  const [state, action, pending] = useActionState<StartExamState, FormData>(startExam, {});
  const final = finals.find((f) => f.subjectId === subjectId) ?? first;
  if (!final) return null;
  return (
    <form action={action} className="flex flex-col gap-2" data-testid="exam-start-final">
      <input type="hidden" name="kind" value="SUBJECT_FINAL" />
      <label htmlFor="exam-final-subject" className="text-xs text-fg-muted">
        Subject
      </label>
      <Select
        id="exam-final-subject"
        name="subjectId"
        value={final.subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
      >
        {finals.map((f) => (
          <option key={f.subjectId} value={f.subjectId}>
            {f.subject} ({f.available})
          </option>
        ))}
      </Select>
      <p className="text-xs text-fg-muted">
        {final.questions > 0
          ? `${final.questions} questions · ${final.minutes} min · all ${final.lectures} lectures`
          : "No questions in the bank for this subject yet"}
      </p>
      <div className="flex flex-col items-start gap-2">
        <Button size="sm" type="submit" loading={pending} disabled={final.questions === 0}>
          Start subject final
        </Button>
        <ErrorText state={state} />
      </div>
    </form>
  );
}

const PRACTICE_SIZES = [10, 20, 50] as const;

/** Practice: any topics, no timer, checked as you go, nothing saved. */
function Practice({ topics }: { topics: TopicChoice[] }) {
  const [selected, setSelected] = useState(() => defaultsFor("DAILY", topics));
  const available = topics.filter((t) => selected.has(t.id)).reduce((n, t) => n + t.questions, 0);
  return (
    <form
      action="/work-station/practice"
      method="get"
      className="flex flex-col gap-3"
      data-testid="practice-start"
    >
      <TopicPicker
        name="topic"
        label="Any topic in the bank"
        topics={topics}
        selected={selected}
        onChange={setSelected}
      />
      <div className="flex items-center gap-2">
        <label htmlFor="practice-size" className="text-xs text-fg-muted">
          Questions
        </label>
        <Select id="practice-size" name="n" defaultValue="20" className="w-24">
          {PRACTICE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <span className="text-xs text-fg-muted">of {available} available</span>
      </div>
      <p className="text-xs text-fg-muted">No timer · answers checked as you go · not saved</p>
      <Button
        size="sm"
        type="submit"
        variant="secondary"
        disabled={available === 0}
        className="self-start"
      >
        Start practice
      </Button>
    </form>
  );
}

/** Start a real exam (daily / weekly on picked topics, or a subject final) or a practice. */
export function ExamStart({ choices }: { choices: ExamChoices }) {
  if (choices.inProgress) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Your {EXAM_LABEL[choices.inProgress.kind].toLowerCase()} is still running.
        </p>
        <Link
          href={`/work-station/exam/${choices.inProgress.id}`}
          className="inline-flex h-8 items-center rounded-sm bg-accent px-3 text-sm text-accent-fg hover:bg-accent-strong"
        >
          Continue exam
        </Link>
      </div>
    );
  }

  if (choices.bankSize === 0) {
    return (
      <p className="text-sm text-fg-muted">
        The question bank is empty. Load questions with{" "}
        <code className="font-mono text-xs">pnpm db:questions</code>.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section aria-labelledby="exam-topics-title" className="flex flex-col gap-2">
        <h3 id="exam-topics-title" className="text-sm font-medium">
          Daily / weekly exam
        </h3>
        <TopicExam topics={choices.topics} />
      </section>
      <section aria-labelledby="exam-final-title" className="flex flex-col gap-2">
        <h3 id="exam-final-title" className="text-sm font-medium">
          Subject final
        </h3>
        <FinalExam finals={choices.finals} />
      </section>
      <section aria-labelledby="practice-title" className="flex flex-col gap-2">
        <h3 id="practice-title" className="text-sm font-medium">
          Practice
        </h3>
        <Practice topics={choices.topics} />
      </section>
    </div>
  );
}
