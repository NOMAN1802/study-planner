import { Check, SkipForward } from "lucide-react";
import { PHASE_LABEL } from "@/lib/pomodoro";
import type { SessionHistoryItem } from "@/lib/pomodoro-server";

export function SessionHistory({
  items,
  timezone,
}: {
  items: SessionHistoryItem[];
  timezone: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        No sessions yet. Finished and skipped sessions will appear here.
      </p>
    );
  }
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (
    <ol className="divide-y divide-border text-sm" aria-label="Recent sessions">
      {items.map((s) => (
        <li key={s.id} className="flex items-center gap-3 py-2" data-testid="session-item">
          {s.completed ? (
            <Check className="size-3.5 text-accent" aria-label="Completed" />
          ) : (
            <SkipForward className="size-3.5 text-fg-subtle" aria-label="Skipped" />
          )}
          <span className="flex-1 text-fg">{PHASE_LABEL[s.type]}</span>
          <span className="font-mono text-xs text-fg-muted tabular-nums">
            {s.type === "FOCUS" ? `${s.focusMinutes} min` : ""}
          </span>
          <span className="w-28 text-right text-xs text-fg-subtle">
            {time.format(new Date(s.startedAt)).replace(",", "")}
          </span>
        </li>
      ))}
    </ol>
  );
}
