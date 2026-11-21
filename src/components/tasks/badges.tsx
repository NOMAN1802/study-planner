import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, STATUS_LABEL, type TaskPriority, type TaskStatus } from "@/schemas/task";

const priorityStyle: Record<TaskPriority, string> = {
  LOW: "text-fg-subtle",
  MEDIUM: "text-fg-muted",
  HIGH: "text-warning",
  URGENT: "text-danger",
};

/** Priority as bars + label; colour is never the only signal. */
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const level = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 }[priority];
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-xs", priorityStyle[priority])}
      data-testid="task-priority"
    >
      <span className="inline-flex items-end gap-px" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("w-0.5 rounded-sm", i <= level ? "bg-current" : "bg-surface-3")}
            style={{ height: 3 + i * 2 }}
          />
        ))}
      </span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const statusStyle: Record<TaskStatus, string> = {
  TODO: "border-border text-fg-muted",
  IN_PROGRESS: "border-accent/40 bg-accent-soft text-fg",
  DONE: "border-transparent bg-surface-3 text-fg-muted",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm border px-1.5 text-[11px] font-medium",
        statusStyle[status],
      )}
      data-testid="task-status"
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
