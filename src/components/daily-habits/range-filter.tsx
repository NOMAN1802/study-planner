import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  RANGE_KINDS,
  rangeLabel,
  rangeQuery,
  type DayRange,
  type RangeKind,
} from "@/lib/daily-habits";
import { cn } from "@/lib/utils";

const arrow =
  "inline-flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg";

/**
 * Daily · Weekly · Monthly · Yearly · Custom, with previous / next for the
 * fixed ranges and a from–to form for custom. Plain links and a GET form, so
 * the range lives in the URL.
 */
export function RangeFilter({
  basePath,
  range,
  today,
}: {
  basePath: string;
  range: DayRange;
  today: string;
}) {
  const href = (kind: RangeKind, date: string, from?: string, to?: string) =>
    `${basePath}?${rangeQuery(kind, date, from, to)}`;
  const anchor = range.kind === "custom" ? range.to : range.date;
  const containsToday = range.from <= today && today <= range.to;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <nav
          aria-label="Report range"
          className="inline-flex flex-wrap rounded-sm border border-border bg-surface p-0.5"
        >
          {RANGE_KINDS.map((r) => (
            <Link
              key={r.kind}
              href={
                r.kind === "custom"
                  ? href("custom", anchor, range.from, range.to)
                  : href(r.kind, anchor)
              }
              aria-current={range.kind === r.kind ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-sm px-3 text-sm transition-colors duration-150",
                range.kind === r.kind
                  ? "bg-surface-3 font-medium text-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>

        {range.prev && range.next ? (
          <div className="flex items-center gap-2">
            <Link
              href={href(range.kind, range.prev)}
              className={arrow}
              aria-label="Previous"
              title="Previous"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <p
              className="min-w-36 text-center text-sm font-medium text-fg"
              data-testid="range-label"
            >
              {rangeLabel(range)}
            </p>
            <Link
              href={href(range.kind, range.next)}
              className={arrow}
              aria-label="Next"
              title="Next"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
            {containsToday ? null : (
              <Link
                href={href(range.kind, today)}
                className="text-sm font-medium text-accent hover:underline"
              >
                Today
              </Link>
            )}
          </div>
        ) : null}
      </div>

      {range.kind === "custom" ? (
        <form method="get" action={basePath} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="range" value="custom" />
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            From
            <input
              type="date"
              name="from"
              defaultValue={range.from}
              required
              className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            To
            <input
              type="date"
              name="to"
              defaultValue={range.to}
              required
              className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-fg"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong"
          >
            Show
          </button>
          <p className="w-full text-sm font-medium text-fg sm:w-auto" data-testid="range-label">
            {rangeLabel(range)}
          </p>
        </form>
      ) : null}
    </div>
  );
}
