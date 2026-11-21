import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { formatDay } from "@/components/workstation/format";
import { requireUser } from "@/lib/auth";
import { getWorkstationData, type WorkstationData } from "@/lib/workstation/server";

/**
 * The signed-in user and their plan, for a Study Station page. Pages other
 * than Today send a user without a plan to Today, where the plan is set up.
 */
export async function loadStation() {
  const user = await requireUser();
  const data = await getWorkstationData(user);
  return { user, data };
}

export async function requireStation() {
  const { user, data } = await loadStation();
  if (!data) redirect("/work-station");
  return { user, data };
}

/** The plan's name and dates over a Study Station page. */
export function StationFrame({
  data,
  section,
  children,
}: {
  data: WorkstationData;
  section: string;
  children: ReactNode;
}) {
  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm text-fg-muted">{section}</p>
          <h2 className="font-display text-2xl font-medium tracking-tight sm:text-[28px]">
            {data.plan.name}
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            <span className="font-mono tabular-nums">
              {formatDay(data.plan.startDay)} → {formatDay(data.schedule.planEnd)}
            </span>
            <span className="hidden sm:inline"> · 50-minute focus, 10-minute break</span>
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
