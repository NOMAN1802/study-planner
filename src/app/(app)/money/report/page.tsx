import type { Metadata } from "next";
import { RangeFilter } from "@/components/daily-habits/range-filter";
import { MoneyReport } from "@/components/money/views";
import { requireUser } from "@/lib/auth";
import { resolveRange } from "@/lib/daily-habits";
import { getMoneyReport, moneyToday } from "@/lib/money-server";

export const metadata: Metadata = { title: "Money report" };

export default async function MoneyReportPage({ searchParams }: PageProps<"/money/report">) {
  const user = await requireUser();
  const today = moneyToday(user);
  const range = resolveRange(await searchParams, today, user.weekStartsOn, "month");
  const data = await getMoneyReport(user, range);

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <RangeFilter basePath="/money/report" range={range} today={today} />
      <MoneyReport data={data} />
    </div>
  );
}
