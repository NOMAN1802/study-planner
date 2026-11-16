import type { Metadata } from "next";
import { PlannerBoard } from "@/components/planner/planner-board";
import { PlannerToolbar } from "@/components/planner/planner-toolbar";
import { requireUser } from "@/lib/auth";
import { dayKeyOf, parsePlannerParams } from "@/lib/planner";
import { getPlannerData } from "@/lib/planner-server";

export const metadata: Metadata = { title: "Planner" };

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  const user = await requireUser();
  const now = new Date();
  const { view, date } = parsePlannerParams(await searchParams, user.timezone, now);
  const data = await getPlannerData(user, view, date, now);
  const today = dayKeyOf(now, user.timezone);

  return (
    <div className="enter mx-auto flex w-full max-w-7xl flex-col gap-4">
      <PlannerToolbar view={view} date={date} today={today} weekStartsOn={user.weekStartsOn} />
      <PlannerBoard
        // Remount on navigation so selection/armed state doesn't leak between ranges.
        key={`${view}-${date}`}
        view={view}
        date={date}
        days={data.days}
        blocks={data.blocks}
        palette={data.palette}
        timezone={user.timezone}
        today={today}
      />
    </div>
  );
}
