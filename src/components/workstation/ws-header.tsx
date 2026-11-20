import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One ruled strip of figures (2 columns on phones, 4 from lg). */
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
      {children}
    </div>
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
    <div className="flex min-w-0 flex-col gap-1 bg-surface px-4 py-3 sm:px-5 sm:py-4">
      <span className="text-[11px] font-medium tracking-[0.08em] text-fg-muted uppercase">
        {label}
      </span>
      <span
        data-testid={testId}
        className={cn(
          "font-mono text-xl font-semibold tabular-nums sm:text-2xl",
          tone === "warning" && "text-warning",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </span>
      {detail ? <span className="text-xs text-pretty text-fg-muted">{detail}</span> : null}
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
