import { Panel } from "@/components/dashboard/panel";
import { ScoreTrend } from "@/components/daily-habits/score-trend";
import { HabitIconTile } from "@/components/habits/habit-icon";
import type { WeekStart } from "@/lib/dates";
import { formatDay, type DayScore, type HabitStats, type Report } from "@/lib/daily-habits";
import { addDays, startOfWeekKey } from "@/lib/planner";
import { cn } from "@/lib/utils";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function Kpi({
  id,
  label,
  value,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-border bg-surface p-4">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="font-mono text-2xl font-medium text-fg tabular-nums" data-testid={`kpi-${id}`}>
        {value}
      </dd>
      {hint ? <dd className="text-xs text-fg-muted">{hint}</dd> : null}
    </div>
  );
}

function Bar({ value }: { value: number | null }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
      <span className="block h-full rounded-full bg-accent" style={{ width: `${value ?? 0}%` }} />
    </span>
  );
}

/** KPIs, charts and tables for one range of the daily habits. */
export function ReportView({
  report,
  weekStartsOn,
  notes,
}: {
  report: Report;
  weekStartsOn: WeekStart;
  notes: Record<string, string>;
}) {
  if (report.countedDays === 0) {
    return (
      <p className="rounded-sm border border-dashed border-border-strong bg-surface p-6 text-sm text-fg-muted">
        Nothing to report for these dates yet: no daily habit counted on them. Tick habits on the
        Daily page and they show up here.
      </p>
    );
  }

  const prayer = report.habits.find((h) => h.preset === "prayer");
  const study = report.habits.find((h) => h.preset === "study");
  const weekdays = Array.from({ length: 7 }, (_, i) => report.weekdays[(weekStartsOn + i) % 7]);
  const noteDays = Object.keys(notes).sort().reverse();
  const long = report.days.length > 62;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi
          id="completion"
          label="Completion"
          value={pct(report.completionPct)}
          hint="ticks done of ticks possible"
        />
        <Kpi id="average" label="Average day score" value={pct(report.averageScore)} />
        <Kpi
          id="perfect"
          label="Perfect days"
          value={String(report.perfectDays)}
          hint={`of ${days(report.countedDays)}`}
        />
        <Kpi
          id="streak"
          label="Perfect-day streak"
          value={days(report.currentStreak)}
          hint={`best ${days(report.bestStreak)}`}
        />
        {prayer ? (
          <Kpi
            id="prayer"
            label="All 5 prayers"
            value={pct(prayer.possible ? Math.round((prayer.done / prayer.possible) * 100) : null)}
            hint={`${prayer.done} of ${days(prayer.possible)} · ${pct(prayer.pct)} of prayers`}
          />
        ) : null}
        {study ? (
          <Kpi
            id="study"
            label="Study 7 h days"
            value={String(study.done)}
            hint={`of ${days(study.possible)}`}
          />
        ) : null}
        {report.best ? (
          <Kpi id="best" label="Best habit" value={pct(report.best.pct)} hint={report.best.name} />
        ) : null}
        {report.weakest ? (
          <Kpi
            id="weakest"
            label="Needs work"
            value={pct(report.weakest.pct)}
            hint={report.weakest.name}
          />
        ) : null}
      </dl>

      {report.days.length > 1 ? (
        <Panel id="score-trend" title="Day score">
          <ScoreTrend days={report.days} />
        </Panel>
      ) : null}

      {long ? (
        <Panel id="calendar" title="Calendar">
          <ScoreCalendar days={report.days} weekStartsOn={weekStartsOn} />
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel id="by-habit" title="By habit" className="lg:col-span-3" bodyClassName="p-0 sm:px-0">
          <HabitTable habits={report.habits} />
        </Panel>
        <Panel id="by-weekday" title="By weekday" className="lg:col-span-2">
          <ul className="flex flex-col gap-2">
            {weekdays.map((w) => (
              <li
                key={w.weekday}
                className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-sm"
              >
                <span className="text-fg-muted">{WEEKDAY[w.weekday]}</span>
                <Bar value={w.pct} />
                <span className="text-right font-mono text-xs tabular-nums">{pct(w.pct)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {noteDays.length ? (
        <Panel id="notes" title="Notes">
          <ul className="flex flex-col gap-2 text-sm">
            {noteDays.map((d) => (
              <li key={d} className="flex gap-3">
                <span className="w-28 shrink-0 text-fg-muted">{formatDay(d)}</span>
                <span className="text-fg">{notes[d]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function HabitTable({ habits }: { habits: HabitStats[] }) {
  return (
    <div
      className="relative overflow-x-auto"
      role="region"
      aria-label="Habits in this range"
      tabIndex={0}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-fg-muted">
            <th scope="col" className="px-4 py-2 text-left font-medium sm:px-5">
              Habit
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Done
            </th>
            <th scope="col" className="w-28 px-2 py-2 text-left font-medium">
              <span className="sr-only">Share</span>
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Score
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium sm:px-5">
              Streak
            </th>
          </tr>
        </thead>
        <tbody>
          {habits.map((h) => (
            <tr
              key={h.id}
              className="border-b border-border last:border-b-0"
              data-testid="report-habit"
            >
              <th scope="row" className="px-4 py-2 text-left font-normal sm:px-5">
                <span className="flex items-center gap-2">
                  <HabitIconTile name={h.icon} color={h.color} />
                  <span className="min-w-0 text-fg">{h.name}</span>
                </span>
              </th>
              <td className="px-2 py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                {h.done}/{h.possible}
              </td>
              <td className="px-2 py-2">
                <Bar value={h.pct} />
              </td>
              <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">{pct(h.pct)}</td>
              <td className="px-4 py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums sm:px-5">
                {h.currentStreak} <span className="text-fg-muted">/ best {h.bestStreak}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const level = (p: number | null) =>
  p === null
    ? "bg-surface-2"
    : p >= 100
      ? "bg-accent"
      : p >= 75
        ? "bg-accent/75"
        : p >= 50
          ? "bg-accent/50"
          : p > 0
            ? "bg-accent/25"
            : "bg-surface-3";

/** A day-by-day calendar for long ranges (a year): weeks as columns, darker = higher score. */
function ScoreCalendar({ days, weekStartsOn }: { days: DayScore[]; weekStartsOn: WeekStart }) {
  if (days.length === 0) return null;
  const byDay = new Map(days.map((d) => [d.day, d]));
  const first = startOfWeekKey(days[0].day, weekStartsOn);
  const last = days[days.length - 1].day;
  const weeks: string[][] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto pb-1" dir="rtl">
        <div className="inline-flex gap-[3px]" dir="ltr" aria-hidden>
          {weeks.map((week) => (
            <div key={week[0]} className="grid grid-rows-7 gap-[3px]">
              {week.map((d) => {
                const s = byDay.get(d);
                return (
                  <span
                    key={d}
                    title={s ? `${formatDay(d)}: ${pct(s.pct)}` : undefined}
                    className={cn("size-3 rounded-[2px]", s ? level(s.pct) : "bg-transparent")}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-2 text-xs text-fg-muted">
        Low
        {[0, 25, 50, 75, 100].map((p) => (
          <span key={p} className={cn("size-3 rounded-[2px]", level(p))} aria-hidden />
        ))}
        High
      </p>
    </div>
  );
}
