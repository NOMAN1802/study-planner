"use client";

import { ArrowDown, ArrowUp, Play } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { moveSubject, setTopicEstimate } from "@/actions/workstation";
import { iconButton, plural } from "@/components/workstation/format";
import { LectureLinks } from "@/components/workstation/lecture-links";
import { SubjectRoutine } from "@/components/workstation/subject-routine";
import { TopicDone } from "@/components/workstation/topic-done";
import { Bar } from "@/components/workstation/ws-header";
import type { WsSubject, WsTopic } from "@/lib/workstation/server";
import { subjectRoutine, type PlanDay, type SubjectProjection } from "@/lib/workstation/schedule";

const ESTIMATES = [1, 2, 3, 4, 5, 6];

export function SubjectsTab({
  subjects,
  projections,
  days,
}: {
  subjects: WsSubject[];
  projections: SubjectProjection[];
  days: PlanDay[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const study = subjects.filter((s) => !s.isDaily);
  const daily = subjects.filter((s) => s.isDaily);
  const projection = new Map(projections.map((p) => [p.subjectId, p]));

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const r = await action();
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">
        Subjects are studied top to bottom. Each lecture is planned at its cycle estimate; tick it
        when you have finished it.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ol className="flex flex-col gap-3" aria-label="Subjects">
        {[...study, ...daily].map((s) => {
          const i = study.indexOf(s);
          const done = s.topics.filter((t) => t.done).length;
          const p = projection.get(s.id);
          return (
            <li
              key={s.id}
              className="rounded-lg border border-border bg-surface"
              data-testid="ws-subject"
            >
              <details open={p?.status === "current"}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {s.isDaily ? s.name : `${i + 1}. ${s.name}`}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <Bar value={done} max={s.topics.length} color={s.color} />
                      <span
                        className="shrink-0 font-mono text-xs text-fg-muted tabular-nums"
                        data-testid="ws-subject-progress"
                      >
                        {done}/{s.topics.length}
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-xs text-fg-muted sm:inline">
                    {s.isDaily
                      ? "Every day"
                      : p?.status === "current"
                        ? "Current"
                        : p?.status === "done"
                          ? "Done"
                          : null}
                  </span>
                </summary>
                <div className="border-t border-border">
                  {!s.isDaily ? (
                    <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-fg-muted">
                      <span>{s.resourceFile}</span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          className={iconButton}
                          disabled={pending || i === 0}
                          onClick={() => run(() => moveSubject(s.id, -1))}
                          aria-label={`Move ${s.name} earlier`}
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={iconButton}
                          disabled={pending || i === study.length - 1}
                          onClick={() => run(() => moveSubject(s.id, 1))}
                          aria-label={`Move ${s.name} later`}
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </button>
                      </span>
                    </div>
                  ) : null}
                  {!s.isDaily ? (
                    <SubjectRoutine
                      name={s.name}
                      color={s.color}
                      routine={subjectRoutine(days, s.id)}
                    />
                  ) : null}
                  <ul
                    className="divide-y divide-border border-t border-border"
                    aria-label={`${s.name} lectures`}
                  >
                    {s.topics.map((t) => (
                      <TopicRow key={t.id} topic={t} taskId={s.taskId} onError={setError} />
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TopicRow({
  topic,
  taskId,
  onError,
}: {
  topic: WsTopic;
  taskId: string;
  onError: (e: string | null) => void;
}) {
  const [, start] = useTransition();
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-2.5" data-testid="ws-topic">
      <TopicDone id={topic.id} title={topic.title} done={topic.done} />
      <div className="min-w-0 flex-1">
        <p className={topic.done ? "text-sm text-fg-subtle line-through" : "text-sm text-fg"}>
          {topic.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-fg-muted">
          <LectureLinks parts={topic.parts} />
          {topic.spentCycles > 0 ? (
            <span className="font-mono tabular-nums">
              {plural(topic.spentCycles, "cycle")} spent
            </span>
          ) : null}
        </p>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-fg-muted">
        <span className="sr-only">Cycles planned for {topic.title}</span>
        <select
          defaultValue={topic.estCycles}
          onChange={(e) => {
            const value = e.currentTarget.value;
            start(async () => {
              const r = await setTopicEstimate(topic.id, value);
              onError(r.error ?? null);
            });
          }}
          className="h-8 rounded-md border border-border bg-surface px-1.5 text-xs text-fg"
        >
          {(ESTIMATES.includes(topic.estCycles) ? ESTIMATES : [...ESTIMATES, topic.estCycles]).map(
            (n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "cycle" : "cycles"}
              </option>
            ),
          )}
        </select>
      </label>
      {!topic.done ? (
        <Link
          href={`/tasks/${taskId}/focus?topic=${topic.id}`}
          className={iconButton}
          aria-label={`Start ${topic.title}`}
          title="Start a study cycle"
        >
          <Play className="size-4" aria-hidden />
        </Link>
      ) : null}
    </li>
  );
}
