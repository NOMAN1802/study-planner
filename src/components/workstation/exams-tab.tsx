import Link from "next/link";
import { DeleteExam, ExamForm, type ExamPreset } from "@/components/workstation/exam-form";
import { ExamStart } from "@/components/workstation/exam-start";
import type { ExamChoices } from "@/lib/workstation/exam-server";
import { formatScore } from "@/lib/workstation/exam";
import { Bar } from "@/components/workstation/ws-header";
import { formatDay, isExam } from "@/components/workstation/format";
import type { WorkstationData } from "@/lib/workstation/server";
import { addDays } from "@/lib/planner";
import type { ItemKind } from "@/lib/workstation/schedule";
import { EXAM_LABEL, type ExamKind } from "@/schemas/workstation";

const EXAM_OF: Partial<Record<ItemKind, ExamKind>> = {
  "weekly-exam": "WEEKLY",
  "subject-final": "SUBJECT_FINAL",
  mock: "MOCK",
};

export function ExamsTab({ data, choices }: { data: WorkstationData; choices: ExamChoices }) {
  const { schedule, subjects, exams, now } = data;
  const study = subjects.filter((s) => !s.isDaily);
  const name = new Map(subjects.map((s) => [s.id, s.name]));
  const horizon = addDays(now.dayKey, 21);

  const upcoming = schedule.days
    .filter((d) => d.day <= horizon)
    .flatMap((d) =>
      d.items
        .filter((i) => isExam(i.kind))
        .map((i) => ({
          day: d.day,
          kind: EXAM_OF[i.kind] as ExamKind,
          subjectId: i.subjectId ?? null,
          label: i.label,
        })),
    );
  const preset: ExamPreset = upcoming.find((u) => u.day === now.dayKey) ?? {
    kind: "WEEKLY",
    day: now.dayKey,
    subjectId: null,
  };

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="take-title"
        className="enter rounded-sm border border-border bg-surface p-4 sm:p-5"
      >
        <h2 id="take-title" className="mb-4 text-sm font-medium">
          Take an exam
        </h2>
        <ExamStart choices={choices} />
      </section>

      <section
        aria-labelledby="record-title"
        className="enter rounded-sm border border-border bg-surface p-4 sm:p-5"
      >
        <h2 id="record-title" className="mb-4 text-sm font-medium">
          Record a result taken elsewhere
        </h2>
        <ExamForm subjects={study.map((s) => ({ id: s.id, name: s.name }))} preset={preset} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="upcoming-title"
          className="enter rounded-sm border border-border bg-surface"
        >
          <header className="flex min-h-11 items-center px-4 pt-3 pb-2 sm:px-5">
            <h2 id="upcoming-title" className="font-display text-base font-medium tracking-tight">
              Next 3 weeks
            </h2>
          </header>
          {upcoming.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">No exams scheduled in the next 3 weeks</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((u, i) => (
                <li
                  key={`${u.day}-${i}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span>{u.label}</span>
                  <span className="shrink-0 text-xs text-fg-muted">
                    {u.day === now.dayKey ? "Today" : formatDay(u.day)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="history-title"
          className="enter rounded-sm border border-border bg-surface"
        >
          <header className="flex min-h-11 items-center justify-between px-4 pt-3 pb-2 sm:px-5">
            <h2 id="history-title" className="font-display text-base font-medium tracking-tight">
              Results
            </h2>
            {exams.length > 0 ? (
              <span className="text-xs text-fg-muted">{exams.length} recorded</span>
            ) : null}
          </header>
          {exams.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">
              No results yet. Weekly exams fall on Fridays; a subject final follows each subject.
            </p>
          ) : (
            <ul className="divide-y divide-border" aria-label="Exam results">
              {exams.map((e) => {
                const pct =
                  e.score !== null && e.total
                    ? Math.max(0, Math.round((e.score / e.total) * 100))
                    : null;
                const title = `${EXAM_LABEL[e.kind]}${e.subjectId ? ` · ${name.get(e.subjectId) ?? ""}` : ""}`;
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 px-4 py-3"
                    data-testid="ws-exam"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {e.taken ? (
                          <Link
                            href={`/work-station/exam/${e.id}`}
                            className="hover:underline"
                            data-testid="ws-exam-open"
                          >
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {formatDay(e.day)}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                      {pct !== null ? (
                        <div className="mt-1 max-w-48">
                          <Bar value={pct} max={100} />
                        </div>
                      ) : null}
                    </div>
                    <span
                      className="shrink-0 font-mono text-sm tabular-nums"
                      data-testid="ws-exam-score"
                    >
                      {e.inProgress
                        ? "In progress"
                        : e.score !== null
                          ? `${formatScore(e.score)}${e.total !== null ? `/${e.total}` : ""}`
                          : "—"}
                      {pct !== null ? (
                        <span className="ml-2 text-xs text-fg-muted">{pct}%</span>
                      ) : null}
                    </span>
                    <DeleteExam id={e.id} label={`${title} on ${formatDay(e.day)}`} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
