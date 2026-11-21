import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatDay, plural } from "@/components/workstation/format";
import { LectureLinks } from "@/components/workstation/lecture-links";
import { TopicDone } from "@/components/workstation/topic-done";
import { Bar, Stat, StatStrip } from "@/components/workstation/ws-header";
import { formatScore } from "@/lib/workstation/exam";
import type { SubjectProjection } from "@/lib/workstation/schedule";
import type { WsExam, WsSubject, WsTopic } from "@/lib/workstation/server";
import { EXAM_LABEL } from "@/schemas/workstation";

/** One study cycle is an hour (50 min focus + 10 min break). */
const hours = (cycles: number) => `${cycles} h`;

/** Latest finished first; undated ones last. */
function byDoneDay(a: WsTopic, b: WsTopic) {
  return (b.doneDay ?? "").localeCompare(a.doneDay ?? "");
}

/**
 * Everything finished so far: finished subjects, done lectures (by subject,
 * latest first) with the hours spent on them, and past exam results. Done
 * lectures stay on the Subjects page too, ticked.
 */
export function ArchivedTab({
  subjects,
  projections,
  exams,
}: {
  subjects: WsSubject[];
  projections: SubjectProjection[];
  exams: WsExam[];
}) {
  const name = new Map(subjects.map((s) => [s.id, s.name]));
  const groups = subjects
    .map((s) => ({ subject: s, done: s.topics.filter((t) => t.done).sort(byDoneDay) }))
    .filter((g) => g.done.length > 0);
  const lectures = groups.reduce((n, g) => n + g.done.length, 0);
  // Counted like the Plan page: lectures of the study subjects, not vocabulary.
  const study = subjects.filter((s) => !s.isDaily);
  const lecturesDone = study.reduce((n, s) => n + s.topics.filter((t) => t.done).length, 0);
  const totalLectures = study.reduce((n, s) => n + s.topics.length, 0);
  const spent = groups.reduce((n, g) => n + g.done.reduce((m, t) => m + t.spentCycles, 0), 0);
  const finishedIds = new Set(
    projections.filter((p) => p.status === "done").map((p) => p.subjectId),
  );
  const finished = subjects.filter((s) => finishedIds.has(s.id));
  const past = exams.filter((e) => !e.inProgress).sort((a, b) => b.day.localeCompare(a.day));

  return (
    <div className="flex flex-col gap-4">
      <StatStrip>
        <Stat
          label="Lectures done"
          value={`${lecturesDone}/${totalLectures}`}
          testId="ws-archived-lectures"
        />
        <Stat label="Hours on them" value={hours(spent)} testId="ws-archived-hours" />
        <Stat
          label="Subjects finished"
          value={String(finished.length)}
          testId="ws-archived-subjects"
        />
        <Stat label="Exams taken" value={String(past.length)} testId="ws-archived-exams" />
      </StatStrip>

      <Section id="archived-subjects" title="Finished subjects" count={finished.length}>
        {finished.length === 0 ? (
          <Empty>A subject lands here once all its lectures are done and its final is taken</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {finished.map((s) => {
              const cycles = s.topics.reduce((n, t) => n + t.spentCycles, 0);
              const last = [...s.topics].sort(byDoneDay)[0]?.doneDay;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                  data-testid="ws-archived-subject"
                >
                  <CheckCircle2
                    className="size-4 shrink-0"
                    style={{ color: s.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs text-fg-muted">
                    {plural(s.topics.length, "lecture")} · {hours(cycles)}
                    {last ? ` · ${formatDay(last)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="archived-lectures" title="Finished lectures" count={lectures}>
        {groups.length === 0 ? (
          <Empty>
            No lectures done yet. Tick a lecture on Today or Subjects and it shows up here.
          </Empty>
        ) : (
          <div className="divide-y divide-border">
            {groups.map(({ subject, done }) => (
              <div key={subject.id} data-testid="ws-archived-group">
                <h3 className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-medium text-fg-muted">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: subject.color }}
                    aria-hidden
                  />
                  {subject.name}
                  <span className="font-normal">
                    · {done.length}/{subject.topics.length}
                  </span>
                </h3>
                <ul aria-label={`${subject.name} finished lectures`}>
                  {done.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start gap-3 px-4 py-2"
                      data-testid="ws-archived-topic"
                    >
                      <TopicDone id={t.id} title={t.title} done />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{t.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                          <span>{t.doneDay ? `Done ${formatDay(t.doneDay)}` : "Done"}</span>
                          <span data-testid="ws-archived-topic-hours">
                            {hours(t.spentCycles)} spent
                          </span>
                          <LectureLinks parts={t.parts} topicId={t.id} book={t.book} />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="archived-exams" title="Past exams" count={past.length}>
        {past.length === 0 ? (
          <Empty>No exams taken yet</Empty>
        ) : (
          <ul className="divide-y divide-border" aria-label="Past exams">
            {past.map((e) => {
              const pct =
                e.score !== null && e.total
                  ? Math.max(0, Math.round((e.score / e.total) * 100))
                  : null;
              const title = `${EXAM_LABEL[e.kind]}${e.subjectId ? ` · ${name.get(e.subjectId) ?? ""}` : ""}`;
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-3"
                  data-testid="ws-archived-exam"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {e.taken ? (
                        <Link href={`/work-station/exam/${e.id}`} className="hover:underline">
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
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    {e.score !== null
                      ? `${formatScore(e.score)}${e.total !== null ? `/${e.total}` : ""}`
                      : "—"}
                    {pct !== null ? (
                      <span className="ml-2 text-xs text-fg-muted">{pct}%</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="enter rounded-sm border border-border bg-surface">
      <header className="flex min-h-11 items-center justify-between px-4 pt-3 pb-2 sm:px-5">
        <h2 id={id} className="font-display text-base font-medium tracking-tight">
          {title}
        </h2>
        {count > 0 ? <span className="text-xs text-fg-muted">{count}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-4 text-sm text-fg-muted sm:px-5">{children}</p>;
}
