import Link from "next/link";
import { ExamTrend } from "@/components/dashboard/exam-trend";
import { formatDay } from "@/components/workstation/format";
import { Bar } from "@/components/workstation/ws-header";
import { formatScore, type ExamStats } from "@/lib/workstation/exam";
import { EXAM_LABEL, type ExamKind } from "@/schemas/workstation";

const label = (kind: string) => EXAM_LABEL[kind as ExamKind] ?? kind;

/** Real exam results (practice is never saved): averages, recent scores, trend, weak topics. */
export function ExamResults({ stats }: { stats: ExamStats }) {
  if (stats.count === 0) {
    return (
      <p className="py-6 text-center text-sm text-fg-muted">
        No exam results yet. Take a daily exam on{" "}
        <Link href="/work-station?tab=exams" className="text-accent hover:underline">
          Work-Station → Exams
        </Link>
        ; practice exams are not counted.
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs text-fg-muted">Average</dt>
            <dd
              className="font-mono text-2xl font-semibold tabular-nums"
              data-testid="exam-average"
            >
              {stats.averagePct}%
            </dd>
          </div>
          {stats.byKind.map((k) => (
            <div key={k.kind}>
              <dt className="text-xs text-fg-muted">
                {label(k.kind)} · {k.count}
              </dt>
              <dd className="font-mono text-lg tabular-nums">{k.averagePct}%</dd>
            </div>
          ))}
        </dl>
        {stats.trend.length > 1 ? (
          <ExamTrend
            points={stats.trend.map((t) => ({
              id: t.id,
              label: formatDay(t.day),
              exam: label(t.kind),
              pct: t.pct,
            }))}
          />
        ) : null}
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-fg-muted">Recent</h3>
          <ul className="divide-y divide-border" aria-label="Recent exam results">
            {stats.recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
                data-testid="exam-recent"
              >
                <span className="min-w-0 truncate">
                  {label(r.kind)}
                  <span className="text-fg-muted"> · {formatDay(r.day)}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums">
                  {formatScore(r.score)}/{r.total}
                  <span className="ml-1.5 text-xs text-fg-muted">{r.pct}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-medium text-fg-muted">Weak topics</h3>
        {stats.weakTopics.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Shows once a topic has 3 or more questions answered in exams taken in the app.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5" aria-label="Weak topics">
            {stats.weakTopics.map((t) => (
              <li key={`${t.lecture}-${t.topic}`} data-testid="exam-weak-topic">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate" title={t.lecture}>
                    {t.topic}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                    {t.correct}/{t.asked} · {t.pct}%
                  </span>
                </div>
                <div className="mt-1">
                  <Bar value={t.pct} max={100} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
