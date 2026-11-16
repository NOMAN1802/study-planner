import type { Heatmap, HeatmapLevel } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const CELL = 14;
const GAP = 3;

const levelClass: Record<HeatmapLevel, string> = {
  0: "bg-surface-3",
  1: "bg-accent/25",
  2: "bg-accent/50",
  3: "bg-accent/75",
  4: "bg-accent",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dateLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "2026-11-15" → "15 Nov 2026" (the key is already a local calendar day). */
function formatDay(key: string): string {
  return dateLabel.format(new Date(`${key}T00:00:00Z`));
}

export function YearHeatmap({ heatmap, weekStartsOn }: { heatmap: Heatmap; weekStartsOn: number }) {
  const columns = `repeat(${heatmap.weeks.length}, ${CELL}px)`;
  return (
    <div className="flex flex-col gap-3">
      {/* rtl scroll container so narrow screens start at the most recent weeks */}
      <div className="overflow-x-auto pb-1" dir="rtl">
        <div className="inline-flex gap-2" dir="ltr">
          <div
            className="grid pt-5 text-[10px] leading-none text-fg-subtle"
            style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }}
            aria-hidden
          >
            {Array.from({ length: 7 }, (_, row) => (
              <span key={row} className="flex items-center">
                {row % 2 === 0 ? WEEKDAYS[(weekStartsOn + row) % 7] : ""}
              </span>
            ))}
          </div>
          <div>
            <div
              className="grid h-5 text-[10px] leading-none text-fg-subtle"
              style={{ gridTemplateColumns: columns, columnGap: GAP }}
              aria-hidden
            >
              {heatmap.months.map((m) => (
                <span
                  key={`${m.week}-${m.label}`}
                  className="whitespace-nowrap"
                  style={{ gridColumnStart: m.week + 1 }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            <div
              role="img"
              aria-label={`${heatmap.total} habit completions on ${heatmap.activeDays} days in the last year`}
              className="grid grid-flow-col"
              style={{
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridAutoColumns: CELL,
                gap: GAP,
              }}
            >
              {heatmap.weeks.flatMap((week, w) =>
                week.map((cell, d) =>
                  cell ? (
                    <span
                      key={cell.date}
                      title={`${formatDay(cell.date)}: ${cell.count} ${cell.count === 1 ? "habit" : "habits"} completed`}
                      data-testid="heatmap-cell"
                      data-date={cell.date}
                      data-count={cell.count}
                      data-level={cell.level}
                      className={cn("rounded-[2px]", levelClass[cell.level])}
                    />
                  ) : (
                    <span key={`empty-${w}-${d}`} />
                  ),
                ),
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
        <p>Daily and hourly habits completed per day.</p>
        <div className="flex items-center gap-1" aria-hidden>
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={cn("size-3 rounded-[2px]", levelClass[level])} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
