import Link from "next/link";
import { cn } from "@/lib/utils";
import { TAB_LABEL, WORKSTATION_TABS, type WorkstationTab } from "@/schemas/workstation";

export function WorkstationTabs({ tab }: { tab: WorkstationTab }) {
  return (
    <nav aria-label="Work-Station sections" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1">
        {WORKSTATION_TABS.map((t) => {
          const active = t === tab;
          return (
            <li key={t}>
              <Link
                href={t === "today" ? "/work-station" : `/work-station?tab=${t}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-[13px] transition-colors duration-150",
                  active
                    ? "bg-surface-2 font-medium text-fg"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {TAB_LABEL[t]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Stat({
  label,
  value,
  detail,
  tone,
  testId,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "warning" | "accent";
  testId?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-surface px-4 py-3">
      <span className="text-xs text-fg-muted">{label}</span>
      <span
        data-testid={testId}
        className={cn(
          "font-mono text-lg font-semibold tabular-nums",
          tone === "warning" && "text-warning",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </span>
      {detail ? <span className="truncate text-xs text-fg-muted">{detail}</span> : null}
    </div>
  );
}

/** A thin progress bar; purely visual, the number is always shown next to it. */
export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
      <div
        className="bar-fill h-full rounded-full bg-accent"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
