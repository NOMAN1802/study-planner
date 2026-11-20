import { Briefcase, Play, Timer } from "lucide-react";
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
import type { WorkstationData } from "@/lib/workstation/server";

export function TodayTab({ data, exam }: { data: WorkstationData; exam: ExamChoices | null }) {
  const { schedule, now, plan, subjects, slots } = data;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const topicById = new Map(subjects.flatMap((s) => s.topics.map((t) => [t.id, t] as const)));
  const current = schedule.subjects.find((p) => p.status === "current");
  const currentSubject = current ? subjectById.get(current.subjectId) : undefined;

  const started = now.dayKey >= plan.startDay;
  const preview = started ? schedule.days.find((d) => d.day === now.dayKey) : schedule.days[0];
  const items = preview?.items ?? [];

  const capacity = studyCyclesByWeekday(slots, data.isHoliday);
  const todayTarget = capacity[now.weekday];
  const weekDone = data.week.reduce((n, d) => n + (data.cyclesByDay[d] ?? 0), 0);
  const weekTarget = weekCycles(slots);
  const dayNumber = daysBetween(plan.startDay, now.dayKey) + 1;
  const totalDays = plan.learningDays + plan.revisionDays;

  /** Where a plan item's Start button goes. */
  function startHref(item: PlanItem): string | null {
    if (isExam(item.kind)) return null;
    const subject = item.subjectId ? subjectById.get(item.subjectId) : currentSubject;
    if (!subject) return null;
    const q = item.topicId ? `?topic=${item.topicId}` : "";
    return `/tasks/${subject.taskId}/focus${q}`;
  }

  // Today's cycles in order: completed ones first, then the plan's labels.
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
          detail="study cycles (50 + 10 min)"
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

      {data.activeTimer ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2">
            <Timer className="size-4 text-accent" aria-hidden />A study timer is running.
          </span>
          <Link
            className={secondaryLink}
            href={`/tasks/${data.activeTimer.taskId}/focus${
              data.activeTimer.topicId ? `?topic=${data.activeTimer.topicId}` : ""
            }`}
          >
            Open timer
          </Link>
        </div>
      ) : null}

      {exam && exam.bankSize > 0 ? <TodayExam choices={exam} /> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section
          aria-labelledby="up-next-title"
          className="enter min-w-0 rounded-lg border border-border bg-surface"
        >
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-1.5 sm:px-5">
            <h2 id="up-next-title" className="font-display text-base font-semibold tracking-tight">
              {started ? "Up next today" : `First day · ${formatDay(plan.startDay)}`}
            </h2>
            {currentSubject ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: currentSubject.color }}
                  aria-hidden
                />
                Current subject: {currentSubject.name}
              </span>
            ) : null}
          </header>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">
              {todayTarget === 0
                ? "No study slots in today's routine."
                : "All of today's cycles are done. Rest well."}
            </p>
          ) : (
            <ul className="divide-y divide-border" aria-label="Today's study items">
              {items.map((item, i) => {
                const topic = item.topicId ? topicById.get(item.topicId) : undefined;
                const subject = item.subjectId ? subjectById.get(item.subjectId) : undefined;
                const href = started ? startHref(item) : null;
                return (
                  <li
                    key={`${item.kind}-${item.topicId ?? item.subjectId ?? ""}-${i}`}
                    className="flex items-start gap-3 px-4 py-3"
                    data-testid="ws-item"
                  >
                    {topic && started ? (
                      <TopicDone id={topic.id} title={topic.title} done={topic.done} />
                    ) : (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: subject?.color ?? "var(--fg-subtle)" }}
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{item.label}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-fg-muted">
                        <span>{KIND_TEXT[item.kind]}</span>
                        <span className="font-mono tabular-nums">
                          {plural(item.cycles, "cycle")}
                        </span>
                        {topic ? (
                          <LectureLinks parts={topic.parts} topicId={topic.id} book={topic.book} />
                        ) : null}
                      </p>
                    </div>
                    {href ? (
                      <Link
                        href={href}
                        className={secondaryLink}
                        aria-label={`Start ${item.label}`}
                      >
                        <Play className="size-3.5" aria-hidden />
                        Start
                      </Link>
                    ) : started && isExam(item.kind) ? (
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
          className="enter min-w-0 rounded-lg border border-border bg-surface"
          style={{ "--enter-index": 1 } as CSSProperties}
        >
          <header className="flex min-h-11 items-center justify-between px-4 pt-3 pb-1.5 sm:px-5">
            <h2 id="timeline-title" className="font-display text-base font-semibold tracking-tight">
              Routine ·{" "}
              {formatDay(now.dayKey, { weekday: "long", day: undefined, month: undefined })}
              {data.isHoliday ? " · Holiday" : ""}
            </h2>
            <span className="sr-only">
              Study days start at {formatMinute(DAY_START_MIN)} the evening before.
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
                      "rounded-md border px-3 py-2",
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
                        {slot.startMin >= DAY_START_MIN ? (
                          <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] font-normal text-fg-muted">
                            {WEEKDAY_SHORT[slot.weekday]} evening
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
                      <ul
                        className="mt-1.5 flex flex-col gap-1"
                        aria-label={`${slot.label} cycles`}
                      >
                        {(marksBySlot.get(slot.id) ?? []).map((m) => {
                          const done = m.index < data.doneToday;
                          const label = done ? "Done" : labels[m.index - data.doneToday]?.label;
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
