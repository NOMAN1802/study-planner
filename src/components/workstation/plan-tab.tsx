import { TriangleAlert } from "lucide-react";
import { formatDay, isExam, plural } from "@/components/workstation/format";
import { PlanLengthForm } from "@/components/workstation/plan-length-form";
import { ResetPlan } from "@/components/workstation/reset-plan";
import { Bar, Stat, StatStrip } from "@/components/workstation/ws-header";
import type { WeekStart } from "@/lib/dates";
import { addDays, startOfWeekKey, weekdayOf } from "@/lib/planner";
import { cn } from "@/lib/utils";
import { WEEKDAY_SHORT } from "@/lib/workstation/routine";
import { HOLIDAY_LECTURE_CYCLES, LECTURE_CYCLES, type PlanDay } from "@/lib/workstation/schedule";
import type { WorkstationData } from "@/lib/workstation/server";

/** The subject that takes most of a day's learning cycles, if any. */
function mainSubject(day: PlanDay | undefined): string | null {
  if (!day) return null;
  const totals = new Map<string, number>();
  for (const item of day.items) {
    if (!item.subjectId || item.kind === "daily" || item.kind === "revision") continue;
    totals.set(item.subjectId, (totals.get(item.subjectId) ?? 0) + item.cycles);
  }
  let best: string | null = null;
  let max = 0;
  for (const [id, n] of totals) {
    if (n > max) {
      best = id;
      max = n;
    }
  }
  return best;
}

export function PlanTab({
  data,
  weekStartsOn,
}: {
  data: WorkstationData;
  weekStartsOn: WeekStart;
}) {
  const { plan, schedule, subjects, now } = data;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const dayByKey = new Map(schedule.days.map((d) => [d.day, d]));
  const study = subjects.filter((s) => !s.isDaily);
  const daily = subjects.find((s) => s.isDaily);

  const totalTopics = study.reduce((n, s) => n + s.topics.length, 0);
  const doneTopics = study.reduce((n, s) => n + s.topics.filter((t) => t.done).length, 0);
  const late =
    schedule.projectedLearningEnd !== null && schedule.projectedLearningEnd > schedule.learningEnd;

  // Calendar: whole weeks covering the plan (and any overflow days).
  const lastScheduled = schedule.days.at(-1)?.day;
  const lastDay =
    lastScheduled && lastScheduled > schedule.planEnd ? lastScheduled : schedule.planEnd;
  const weeks: string[][] = [];
  for (let d = startOfWeekKey(plan.startDay, weekStartsOn); d <= lastDay; d = addDays(d, 7))
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));

  return (
    <div className="flex flex-col gap-4">
      <StatStrip>
        <Stat
          label="Lectures done"
          value={`${doneTopics}/${totalTopics}`}
          detail={plural(study.length, "subject")}
          testId="ws-lectures-done"
        />
        <Stat
          label="Learning ends"
          value={formatDay(schedule.learningEnd)}
          detail={
            schedule.projectedLearningEnd
              ? `Projected ${formatDay(schedule.projectedLearningEnd)}`
              : "All learning done"
          }
          tone={late ? "warning" : undefined}
        />
        <Stat
          label="Exam-ready by"
          value={formatDay(schedule.planEnd)}
          detail={`${plan.learningDays} learning + ${plan.revisionDays} revision days`}
        />
        <Stat
          label="Learning left"
          value={`${schedule.remainingLearningCycles}`}
          detail={
            schedule.bufferDays >= 0
              ? `cycles · ${plural(schedule.bufferDays, "spare day")}`
              : `cycles · ${plural(-schedule.bufferDays, "day")} late`
          }
          tone={schedule.bufferDays < 0 ? "warning" : undefined}
        />
      </StatStrip>

      {late ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-sm border border-border bg-surface px-4 py-3 text-sm text-fg"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            At {LECTURE_CYCLES / 2} lectures a day ({HOLIDAY_LECTURE_CYCLES / 2} on Fridays and
            holidays) the remaining lectures run {plural(-schedule.bufferDays, "day")} past the
            learning phase. Add learning days, lower lecture estimates, or catch up on your off day.
          </span>
        </p>
      ) : null}

      <section
        aria-labelledby="subjects-plan-title"
        className="enter rounded-sm border border-border bg-surface"
      >
        <header className="flex min-h-11 items-center justify-between px-4 pt-3 pb-2 sm:px-5">
          <h2
            id="subjects-plan-title"
            className="font-display text-base font-medium tracking-tight"
          >
            Subjects in order
          </h2>
          <span className="text-xs text-fg-muted">Projected from today</span>
        </header>
        <ol className="divide-y divide-border">
          {schedule.subjects.map((p, i) => {
            const s = subjectById.get(p.subjectId);
            if (!s) return null;
            return (
              <li
                key={p.subjectId}
                className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[1.5rem_1fr_9rem_11rem] sm:items-center"
                data-testid="ws-plan-subject"
              >
                <span className="font-mono text-xs text-fg-muted tabular-nums">{i + 1}</span>
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="truncate">{s.name}</span>
                  {p.status === "current" ? (
                    <span className="text-xs font-medium text-mark">Current</span>
                  ) : p.status === "done" ? (
                    <span className="rounded-sm border border-border px-1.5 text-[11px] leading-5 text-fg-muted">
                      Done
                    </span>
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <Bar value={p.doneTopics} max={p.totalTopics} color={s.color} />
                  <span className="w-10 shrink-0 text-right font-mono text-xs text-fg-muted tabular-nums">
                    {p.doneTopics}/{p.totalTopics}
                  </span>
                </div>
                <span className="text-xs text-fg-muted sm:text-right">
                  {p.status === "done"
                    ? "Final exam done"
                    : p.projectedStart && p.projectedEnd
                      ? `${formatDay(p.projectedStart)} → ${formatDay(p.projectedEnd)}`
                      : "Not scheduled"}
                </span>
              </li>
            );
          })}
          {daily ? (
            <li className="flex items-center gap-2 px-4 py-3 text-sm text-fg-muted">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: daily.color }}
                aria-hidden
              />
              {daily.name}: 10 new words a day Saturday–Thursday, and revision of the week&apos;s 60
              words on Friday.
            </li>
          ) : null}
        </ol>
      </section>

      <section
        aria-labelledby="calendar-title"
        className="enter rounded-sm border border-border bg-surface"
      >
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 sm:px-5">
          <h2 id="calendar-title" className="font-display text-base font-medium tracking-tight">
            {plan.learningDays + plan.revisionDays}-day roadmap
          </h2>
          <span className="flex flex-wrap items-center gap-3 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm border border-fg" aria-hidden />
              Exam day
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-surface-2" aria-hidden />
              Revision
            </span>
          </span>
        </header>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[20rem] border-separate border-spacing-1 text-xs">
            <caption className="sr-only">
              Plan calendar. Each day shows its main subject, exam days and completed cycles.
            </caption>
            <thead>
              <tr>
                {weeks[0]?.map((d) => (
                  <th key={d} scope="col" className="font-normal text-fg-muted">
                    {WEEKDAY_SHORT[weekdayOf(d)]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]}>
                  {week.map((d) => {
                    if (d < plan.startDay || d > lastDay) return <td key={d} />;
                    const day = dayByKey.get(d);
                    const past = d < now.dayKey;
                    const done = data.cyclesByDay[d] ?? 0;
                    const main = mainSubject(day);
                    const subject = main ? subjectById.get(main) : undefined;
                    const exam = day?.items.some((i) => isExam(i.kind)) ?? false;
                    const label = [
                      formatDay(d),
                      past
                        ? `${plural(done, "cycle")} done`
                        : subject
                          ? subject.name
                          : day && day.items.length > 0
                            ? "Revision"
                            : "Free",
                      exam ? "exam day" : null,
                      d > schedule.planEnd ? "after plan end" : null,
                    ]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <td key={d} className="p-0">
                        <div
                          role="img"
                          aria-label={label}
                          title={label}
                          className={cn(
                            "relative flex h-9 flex-col justify-between rounded-sm px-1 py-0.5",
                            exam && "outline-1 -outline-offset-1 outline-fg",
                            d === now.dayKey &&
                              "ring-2 ring-mark ring-offset-1 ring-offset-surface",
                            past ? "bg-surface" : "bg-surface-2",
                            d > schedule.planEnd && "opacity-60",
                          )}
                        >
                          {!past && subject ? (
                            <span
                              className="absolute inset-x-1 bottom-1 h-0.5 rounded-full"
                              style={{ backgroundColor: subject.color }}
                              aria-hidden
                            />
                          ) : null}
                          <span className="font-mono text-[11px] text-fg tabular-nums">
                            {Number(d.slice(8))}
                          </span>
                          {past && done > 0 ? (
                            <span className="self-end font-mono text-[11px] text-fg tabular-nums">
                              {done}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="plan-settings-title"
        className="enter rounded-sm border border-border bg-surface"
      >
        <header className="flex min-h-11 items-center px-4 pt-3 pb-2 sm:px-5">
          <h2
            id="plan-settings-title"
            className="font-display text-base font-medium tracking-tight"
          >
            Plan length and holidays
          </h2>
        </header>
        <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <PlanLengthForm
            startDay={plan.startDay}
            learningDays={plan.learningDays}
            revisionDays={plan.revisionDays}
            holidays={plan.holidays}
          />
          <ResetPlan />
        </div>
      </section>
    </div>
  );
}
