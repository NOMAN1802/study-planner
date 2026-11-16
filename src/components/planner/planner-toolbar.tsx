import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { dayKeyLabel } from "@/components/planner/format";
import { PLANNER_VIEWS, shiftKey, viewDayKeys, type PlannerView } from "@/lib/planner";
import { cn } from "@/lib/utils";
import type { WeekStart } from "@/lib/dates";

const href = (view: PlannerView, date: string) => `/planner?view=${view}&date=${date}`;

function rangeLabel(view: PlannerView, date: string, weekStartsOn: WeekStart): string {
  if (view === "day") return dayKeyLabel(date, "long");
  if (view === "month") return dayKeyLabel(date, "month");
  const keys = viewDayKeys("week", date, weekStartsOn);
  const first = keys[0];
  const last = keys[6];
  const [fy, fm] = first.split("-");
  const [ly, lm] = last.split("-");
  const lastLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${last}T00:00:00Z`));
  const firstLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    ...(fm !== lm || fy !== ly ? { month: "short" } : {}),
    ...(fy !== ly ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${first}T00:00:00Z`));
  return `${firstLabel} – ${lastLabel}`;
}

export function PlannerToolbar({
  view,
  date,
  today,
  weekStartsOn,
}: {
  view: PlannerView;
  date: string;
  today: string;
  weekStartsOn: WeekStart;
}) {
  const nav =
    "inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Link
          href={href(view, shiftKey(view, date, -1))}
          className={nav}
          aria-label={`Previous ${view}`}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <Link
          href={href(view, today)}
          className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-[13px] text-fg transition-colors duration-150 hover:bg-surface-2"
        >
          Today
        </Link>
        <Link
          href={href(view, shiftKey(view, date, 1))}
          className={nav}
          aria-label={`Next ${view}`}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <h2
          className="ml-1 font-display text-lg font-semibold tracking-tight"
          data-testid="planner-range"
        >
          {rangeLabel(view, date, weekStartsOn)}
        </h2>
      </div>
      <nav
        aria-label="Planner views"
        className="inline-flex rounded-md border border-border bg-surface p-0.5"
      >
        {PLANNER_VIEWS.map((v) => (
          <Link
            key={v}
            href={href(v, date)}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center rounded px-3 text-[13px] capitalize transition-colors duration-150",
              view === v ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {v}
          </Link>
        ))}
      </nav>
    </div>
  );
}
