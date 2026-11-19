import type { Metadata } from "next";
import Link from "next/link";
import { DailyRings } from "@/components/dashboard/daily-rings";
import { FocusChart } from "@/components/dashboard/focus-chart";
import { Panel } from "@/components/dashboard/panel";
import { StreakList } from "@/components/dashboard/streak-list";
import { TaskTime } from "@/components/dashboard/task-time";
import { TodayPanel } from "@/components/dashboard/today-panel";
import { YearHeatmap } from "@/components/dashboard/year-heatmap";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-server";
import { getExamStats } from "@/lib/workstation/exam-server";
import { getStudySummary } from "@/lib/workstation/server";
import { ExamResults } from "@/components/dashboard/exam-results";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const [data, study, exams] = await Promise.all([
    getDashboardData(user, now),
    getStudySummary(user, now),
    getExamStats(user),
  ]);

  if (data.empty) {
    return (
      <div className="enter mx-auto flex w-full max-w-page flex-col gap-6">
        <EmptyState
          title="Nothing to track yet"
          description="Add your first habit or task and today's progress, streaks, and focus time will show up here."
          action={
            <Link
              href="/habits"
              className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong"
            >
              Go to habits
            </Link>
          }
        />
      </div>
    );
  }

  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: user.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const habitsLeft = data.habits.filter((h) => !h.complete).length;
  const tasksLeft = data.tasks.filter((t) => !t.done).length;

  return (
    <div className="mx-auto grid w-full max-w-page gap-4 lg:grid-cols-5 2xl:grid-cols-12">
      <Panel
        id="today"
        index={0}
        title={`Today · ${today}`}
        aside={
          <span data-testid="today-summary">
            {habitsLeft} {habitsLeft === 1 ? "habit" : "habits"} · {tasksLeft}{" "}
            {tasksLeft === 1 ? "task" : "tasks"} left
          </span>
        }
        className={study ? "lg:col-span-5 2xl:col-span-7" : "lg:col-span-5 2xl:col-span-12"}
      >
        <TodayPanel habits={data.habits} tasks={data.tasks} />
      </Panel>

      {study ? (
        <Panel
          id="study"
          index={1}
          title="BCS study"
          aside={
            <Link href="/work-station" className="font-medium text-accent hover:underline">
              Open Work-Station
            </Link>
          }
          className="lg:col-span-5 2xl:col-span-5"
        >
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: "Today", done: study.today, target: study.todayTarget, id: "today" },
              { label: "This week", done: study.week, target: study.weekTarget, id: "week" },
            ].map((row) => (
              <div key={row.id} className="flex flex-col gap-1.5">
                <dt className="text-xs text-fg-muted">{row.label} · study cycles</dt>
                <dd
                  className="font-mono text-2xl font-semibold tabular-nums"
                  data-testid={`study-${row.id}`}
                >
                  {row.done}/{row.target}
                </dd>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                  <div
                    className="bar-fill h-full rounded-full bg-accent"
                    style={{
                      width: `${row.target ? Math.min(100, (row.done / row.target) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      {exams ? (
        <Panel
          id="exams"
          index={1}
          title="Exam results"
          aside={
            <span data-testid="exam-count">
              {exams.count} real {exams.count === 1 ? "exam" : "exams"}
            </span>
          }
          className="lg:col-span-5 2xl:col-span-12"
        >
          <ExamResults stats={exams} />
        </Panel>
      ) : null}

      <Panel index={1} id="targets" title="Daily targets" className="lg:col-span-2 2xl:col-span-4">
        <DailyRings ring={data.dailyRing} habits={data.dailyHabits} taskRing={data.taskRing} />
      </Panel>

      <Panel index={2} id="focus" title="Focus minutes" className="lg:col-span-3 2xl:col-span-8">
        <FocusChart series={data.focus} />
      </Panel>

      <Panel
        id="heatmap"
        index={3}
        title="Last 12 months"
        aside={
          <>
            <span className="font-mono text-fg tabular-nums" data-testid="heatmap-total">
              {data.heatmap.total}
            </span>{" "}
            completions on{" "}
            <span className="font-mono text-fg tabular-nums" data-testid="heatmap-days">
              {data.heatmap.activeDays}
            </span>{" "}
            days
          </>
        }
        className="lg:col-span-5 2xl:col-span-12"
      >
        <YearHeatmap heatmap={data.heatmap} weekStartsOn={user.weekStartsOn} />
      </Panel>

      <Panel
        index={4}
        id="streaks"
        title="Streaks"
        className="lg:col-span-2 2xl:col-span-4"
        bodyClassName="py-2"
      >
        <StreakList rows={data.streaks} />
      </Panel>

      <Panel
        index={5}
        id="task-time"
        title="Target vs. actual time"
        className="lg:col-span-3 2xl:col-span-8"
      >
        <TaskTime rows={data.taskTime} />
      </Panel>
    </div>
  );
}
