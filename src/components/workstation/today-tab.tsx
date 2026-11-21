import { Briefcase, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  KIND_TEXT,
  daysBetween,
  formatDay,
  isExam,
  plural,
  secondaryLink,
} from "@/components/workstation/format";
import { LectureLinks } from "@/components/workstation/lecture-links";
import { TodayExam } from "@/components/workstation/today-exam";
import { ItemDone } from "@/components/workstation/item-done";
import { TopicDone } from "@/components/workstation/topic-done";
import type { ExamChoices } from "@/lib/workstation/exam-server";
import { Bar, Stat, StatStrip } from "@/components/workstation/ws-header";
import { cn } from "@/lib/utils";
import {
  KIND_LABEL,
  DAY_START_MIN,
  WEEKDAY_SHORT,
  cycleMarks,
  formatMinute,
  studyCyclesByWeekday,
  studyDaySlots,
  weekCycles,
} from "@/lib/workstation/routine";
import { cycleLabels, type PlanItem } from "@/lib/workstation/schedule";
import { todayProgress, type TodayItem } from "@/lib/workstation/today";
import type { WorkstationData } from "@/lib/workstation/server";

export function TodayTab({ data, exam }: { data: WorkstationData; exam: ExamChoices | null }) {
  const { schedule, now, plan, subjects, slots } = data;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const topicById = new Map(subjects.flatMap((s) => s.topics.map((t) => [t.id, t] as const)));
  const current = schedule.subjects.find((p) => p.status === "current");
  const currentSubject = current ? subjectById.get(current.subjectId) : undefined;

  const started = now.dayKey >= plan.startDay;
  // Before the plan starts: a preview of the first day, nothing to tick yet.
  const items: (PlanItem & Partial<TodayItem>)[] = started
    ? data.today
    : (schedule.days[0]?.items ?? []);
  const progress = todayProgress(data.today);

  const capacity = studyCyclesByWeekday(slots, data.isHoliday);
  const todayTarget = capacity[now.weekday];
  const weekDone = data.week.reduce((n, d) => n + (data.cyclesByDay[d] ?? 0), 0);
  const weekTarget = weekCycles(slots);
  const dayNumber = daysBetween(plan.startDay, now.dayKey) + 1;
  const totalDays = plan.learningDays + plan.revisionDays;

  // Today's items laid over the routine's cycles, in plan order.
  const labels = cycleLabels(items);
  const daySlots = studyDaySlots(slots, now.weekday, data.isHoliday);
  const marksBySlot = new Map<string, { start: number; end: number; index: number }[]>();
  let k = 0;
  for (const slot of daySlots) {
    marksBySlot.set(
      slot.id,
      cycleMarks(slot).map((m) => ({ start: m.start, end: m.end, index: k++ })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StatStrip>
        <Stat
          label="Today"
          value={`${data.doneToday}/${todayTarget}`}
          detail="study hours ticked done"
          testId="ws-today-cycles"
        />
        <Stat
          label="This week"
          value={`${weekDone}/${weekTarget}`}
          detail={`${formatDay(data.week[0])} – ${formatDay(data.week[6])}`}
          testId="ws-week-cycles"
        />
        <Stat
          label={started ? "Plan day" : "Plan starts"}
          value={
            started ? `${Math.min(dayNumber, totalDays)}/${totalDays}` : formatDay(plan.startDay)
          }
          detail={
            started
              ? dayNumber <= plan.learningDays
                ? "Learning phase"
                : "Revision phase"
              : `in ${plural(daysBetween(now.dayKey, plan.startDay), "day")}`
          }
        />
        <Stat
          label="Buffer"
          value={`${schedule.bufferDays >= 0 ? "+" : ""}${schedule.bufferDays}`}
          detail={schedule.bufferDays >= 0 ? "spare days before revision" : "days behind plan"}
          tone={schedule.bufferDays < 0 ? "warning" : "accent"}
          testId="ws-buffer"
        />
      </StatStrip>

      {exam && exam.bankSize > 0 ? <TodayExam choices={exam} /> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section
          aria-labelledby="up-next-title"
          className="enter min-w-0 rounded-sm border border-border bg-surface"
        >
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 sm:px-5">
            <h2 id="up-next-title" className="font-display text-base font-medium tracking-tight">
              {!started
                ? `First day · ${formatDay(plan.startDay)}`
                : progress.complete
                  ? "Study session complete"
                  : "Today's study"}
            </h2>
            {currentSubject ? (
              <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: currentSubject.color }}
                  aria-hidden
                />
                Current subject: {currentSubject.name}
              </span>
            ) : null}
          </header>
          {started && progress.complete ? (
            <div
              className="flex items-start gap-3 border-t border-border px-4 py-4 sm:px-5"
              role="status"
              data-testid="ws-session-complete"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="text-sm font-medium text-fg">
                  All {plural(items.length, "item")} done · {plural(progress.done, "hour")} of study
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {formatDay(now.dayKey, { weekday: "long" })}. Untick an item below if it
                  isn&apos;t finished yet.
                </p>
              </div>
            </div>
          ) : null}
          {items.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">
              {todayTarget === 0
                ? "No study slots in today's routine"
                : "Nothing planned for today. Rest well."}
            </p>
          ) : (
            <ul className="divide-y divide-border" aria-label="Today's study items">
              {items.map((item, i) => {
                const topic = item.topicId ? topicById.get(item.topicId) : undefined;
                const subject = item.subjectId ? subjectById.get(item.subjectId) : undefined;
                const done = started && item.done === true;
                return (
                  <li
                    key={item.key ?? `${item.kind}-${item.topicId ?? item.subjectId ?? ""}-${i}`}
                    className="flex items-start gap-3 px-4 py-3"
                    data-testid="ws-item"
                    data-done={done ? "true" : undefined}
                  >
                    {!started ? (
                      <span
                        className="mt-2 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: subject?.color ?? "var(--fg-subtle)" }}
                        aria-hidden
                      />
                    ) : item.via === "topic" && topic ? (
                      <TopicDone id={topic.id} title={topic.title} done={topic.done} />
                    ) : item.via === "check" && item.key ? (
                      <ItemDone
                        itemKey={item.key}
                        cycles={item.cycles}
                        label={item.label}
                        done={done}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={done}
                        disabled
                        aria-label={
                          done ? `${item.label}: result recorded` : `${item.label}: not taken yet`
                        }
                        title="Ticked once the result is recorded"
                        className="mt-0.5 size-4 shrink-0 rounded-sm accent-(--accent)"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          done ? "text-fg-subtle line-through" : "text-fg",
                        )}
                      >
                        {item.label}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-fg-muted">
                        <span>{KIND_TEXT[item.kind]}</span>
                        <span className="font-mono tabular-nums">
                          {plural(item.cycles, "hour")}
                        </span>
                        {topic && item.kind === "topic" ? (
                          <LectureLinks parts={topic.parts} topicId={topic.id} book={topic.book} />
                        ) : null}
                      </p>
                    </div>
                    {started && isExam(item.kind) && !done ? (
                      <Link href="/work-station/exams" className={secondaryLink}>
                        Record score
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="timeline-title"
          className="enter min-w-0 rounded-sm border border-border bg-surface"
          style={{ "--enter-index": 1 } as CSSProperties}
        >
          <header className="flex min-h-11 items-center justify-between px-4 pt-3 pb-2 sm:px-5">
            <h2 id="timeline-title" className="font-display text-base font-medium tracking-tight">
              Routine ·{" "}
              {formatDay(now.dayKey, { weekday: "long", day: undefined, month: undefined })}
              {data.isHoliday ? " · Holiday" : ""}
            </h2>
            <span className="sr-only">
              Study days run from {formatMinute(DAY_START_MIN)} to {formatMinute(DAY_START_MIN)} the
              next morning.
            </span>
            <span className="font-mono text-xs text-fg-muted tabular-nums">
              {formatMinute(now.minute)}
            </span>
          </header>
          {daySlots.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">
              Nothing in today&apos;s routine.{" "}
              <Link href="/work-station/routine" className="text-accent hover:underline">
                Edit routine
              </Link>
            </p>
          ) : (
            <ol className="flex flex-col gap-1 p-3" aria-label="Today's routine">
              {daySlots.map((slot) => {
                const isNow = slot.startMin <= now.minute && now.minute < slot.endMin;
                return (
                  <li
                    key={slot.id}
                    className={cn(
                      "rounded-sm border px-3 py-2",
                      isNow ? "border-mark bg-mark-soft" : "border-transparent",
                    )}
                    aria-current={isNow ? "time" : undefined}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="inline-flex items-center gap-2 font-medium">
                        {slot.kind === "OFFICE" ? (
                          <Briefcase className="size-3.5 text-fg-muted" aria-hidden />
                        ) : null}
                        {slot.label}
                        {slot.startMin < DAY_START_MIN ? (
                          <span className="rounded-sm bg-surface-2 px-1.5 py-px text-[11px] font-normal text-fg-muted">
                            {WEEKDAY_SHORT[slot.weekday]} night
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-xs text-fg-muted tabular-nums">
                        {formatMinute(slot.startMin)}–{formatMinute(slot.endMin)}
                      </span>
                    </div>
                    {slot.kind !== "STUDY" ? (
                      <span className="text-xs text-fg-muted">{KIND_LABEL[slot.kind]}</span>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-1" aria-label={`${slot.label} cycles`}>
                        {(marksBySlot.get(slot.id) ?? []).map((m) => {
                          const item = labels[m.index];
                          const done = started && item?.done === true;
                          const label = item?.label;
                          const live = now.minute >= m.start && now.minute < m.end;
                          return (
                            <li
                              key={m.start}
                              className={cn(
                                "flex items-baseline gap-2 text-xs",
                                done ? "text-fg-subtle" : "text-fg-muted",
                                live && "font-medium text-fg",
                              )}
                            >
                              <span className="w-11 shrink-0 font-mono tabular-nums">
                                {formatMinute(m.start)}
                              </span>
                              <span className={cn("truncate", done && "line-through")}>
                                {label ?? "Free cycle"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="border-t border-border px-4 py-3">
            <div className="mb-1 flex justify-between text-xs text-fg-muted">
              <span>Today</span>
              <span className="font-mono tabular-nums">
                {data.doneToday}/{todayTarget}
              </span>
            </div>
            <Bar value={data.doneToday} max={todayTarget} />
          </div>
        </section>
      </div>
    </div>
  );
}
