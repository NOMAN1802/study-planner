import type { Metadata } from "next";
import { ExamsTab } from "@/components/workstation/exams-tab";
import { formatDay } from "@/components/workstation/format";
import { OfficeTab } from "@/components/workstation/office-tab";
import { PlanTab } from "@/components/workstation/plan-tab";
import { RoutineTab } from "@/components/workstation/routine-tab";
import { SetupForm } from "@/components/workstation/setup-form";
import { SubjectsTab } from "@/components/workstation/subjects-tab";
import { TodayTab } from "@/components/workstation/today-tab";
import { WorkstationTabs } from "@/components/workstation/ws-header";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/planner";
import { getTaskRows } from "@/lib/tasks";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";
import { defaultRoutine, localNow, studyCyclesByWeekday } from "@/lib/workstation/routine";
import { getExamChoices } from "@/lib/workstation/exam-server";
import { getRoutineSlots, getWorkstationData } from "@/lib/workstation/server";
import { DEFAULT_FILTERS } from "@/schemas/task";
import { parseTab } from "@/schemas/workstation";

export const metadata: Metadata = { title: "Study Station" };

export default async function WorkstationPage({ searchParams }: PageProps<"/work-station">) {
  const tab = parseTab((await searchParams).tab);
  const user = await requireUser();
  const data = await getWorkstationData(user);

  if (!data) return <Setup timezone={user.timezone} />;

  const officeTasks =
    tab === "office"
      ? await getTaskRows(user, { ...DEFAULT_FILTERS, status: "all" }, new Date(), "OFFICE")
      : [];
  const examChoices =
    tab === "exams" || tab === "today" ? await getExamChoices(user, data.plan.id) : null;

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
            {data.plan.name}
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            <span className="font-mono tabular-nums">
              {formatDay(data.plan.startDay)} → {formatDay(data.schedule.planEnd)}
            </span>
            <span className="hidden sm:inline"> · 50-minute focus, 10-minute break</span>
          </p>
        </div>
        <WorkstationTabs tab={tab} />
      </div>

      {tab === "today" ? <TodayTab data={data} exam={examChoices} /> : null}
      {tab === "plan" ? <PlanTab data={data} weekStartsOn={user.weekStartsOn} /> : null}
      {tab === "subjects" ? (
        <SubjectsTab
          subjects={data.subjects}
          projections={data.schedule.subjects}
          days={data.schedule.days}
        />
      ) : null}
      {tab === "exams" && examChoices ? <ExamsTab data={data} choices={examChoices} /> : null}
      {tab === "office" ? <OfficeTab tasks={officeTasks} slots={data.slots} /> : null}
      {tab === "routine" ? <RoutineTab slots={data.slots} /> : null}
    </div>
  );
}

async function Setup({ timezone }: { timezone: string }) {
  const user = await requireUser();
  const existing = await getRoutineSlots(user.id);
  const routine = existing.length > 0 ? existing : defaultRoutine();
  const perDay = studyCyclesByWeekday(routine);
  const study = BCS_SYLLABUS.filter((s) => !s.isDaily);
  const lectures = study.reduce((n, s) => n + s.topics.length, 0);
  const tomorrow = addDays(localNow(new Date(), timezone).dayKey, 1);

  return (
    <div className="enter mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Set up your BCS study plan
        </h2>
        <p className="mt-1 max-w-prose text-sm text-fg-muted">
          Study Station plans study around your office hours: {perDay[6]} study cycles on office days
          and {perDay[5]} on Friday, {perDay.reduce((a, b) => a + b, 0)} a week. One cycle is 50
          minutes of focus and a 10-minute break.
        </p>
      </div>
      <section
        aria-labelledby="setup-subjects"
        className="rounded-lg border border-border bg-surface"
      >
        <header className="flex min-h-11 items-center justify-between px-4 pt-3 pb-1.5 sm:px-5">
          <h3 id="setup-subjects" className="font-display text-base font-semibold tracking-tight">
            Subjects, hardest first
          </h3>
          <span className="text-xs text-fg-muted">{lectures} lectures</span>
        </header>
        <ol className="grid gap-x-6 gap-y-1.5 p-4 text-sm sm:grid-cols-2">
          {study.map((s, i) => (
            <li key={s.name} className="flex items-center gap-2">
              <span className="w-4 font-mono text-xs text-fg-muted tabular-nums">{i + 1}</span>
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="font-mono text-xs text-fg-muted tabular-nums">
                {s.topics.length}
              </span>
            </li>
          ))}
        </ol>
        <p className="border-t border-border px-4 py-3 text-xs text-fg-muted">
          Plus English Vocabulary every day, a weekly exam and revision on Fridays, and a final exam
          after each subject. You can reorder subjects and change the routine later.
        </p>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <SetupForm defaultStart={tomorrow} />
      </section>
    </div>
  );
}
