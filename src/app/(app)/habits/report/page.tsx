import type { Metadata } from "next";
import { RangeFilter } from "@/components/daily-habits/range-filter";
import { ReportView } from "@/components/daily-habits/report-view";
import { requireUser } from "@/lib/auth";
import { resolveRange } from "@/lib/daily-habits";
import { getHabitReport, todayKey } from "@/lib/daily-habits-server";

export const metadata: Metadata = { title: "Habit report" };

export default async function HabitReportPage({ searchParams }: PageProps<"/habits/report">) {
  const user = await requireUser();
  const today = todayKey(user);
  const range = resolveRange(await searchParams, today, user.weekStartsOn, "month");
  const data = await getHabitReport(user, range);

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <RangeFilter basePath="/habits/report" range={range} today={today} />
      <ReportView report={data.report} weekStartsOn={user.weekStartsOn} notes={data.notes} />
    </div>
  );
}
