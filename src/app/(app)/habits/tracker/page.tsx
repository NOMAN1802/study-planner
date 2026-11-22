import type { Metadata } from "next";
import Link from "next/link";
import { RangeFilter } from "@/components/daily-habits/range-filter";
import { ScoreTrend } from "@/components/daily-habits/score-trend";
import { TrackerGrid } from "@/components/daily-habits/tracker-grid";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { resolveRange } from "@/lib/daily-habits";
import { getHabitReport, todayKey } from "@/lib/daily-habits-server";

export const metadata: Metadata = { title: "Habit tracker" };

export default async function HabitTrackerPage({ searchParams }: PageProps<"/habits/tracker">) {
  const user = await requireUser();
  const today = todayKey(user);
  const range = resolveRange(await searchParams, today, user.weekStartsOn, "month");
  const data = await getHabitReport(user, range);

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <RangeFilter basePath="/habits/tracker" range={range} today={today} />
      {data.habits.length === 0 ? (
        <EmptyState
          title="No daily habits in these dates"
          description="Add your daily set on the Daily page, then tick habits to fill this page."
          action={
            <Link
              href="/habits/daily"
              className="inline-flex h-9 items-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong"
            >
              Go to Daily
            </Link>
          }
        />
      ) : (
        <>
          {data.report.days.length > 1 ? (
            <Panel id="tracker-trend" title="Day score">
              <ScoreTrend days={data.report.days} />
            </Panel>
          ) : null}
          <TrackerGrid
            key={`${range.from}-${range.to}`}
            habits={data.habits}
            from={range.from}
            to={range.to}
            today={today}
            cells={data.cells}
          />
        </>
      )}
    </div>
  );
}
