import { Briefcase, Plus } from "lucide-react";
import Link from "next/link";
import { TaskList } from "@/components/tasks/task-list";
import { EmptyState } from "@/components/ui/empty-state";
import { primaryLink } from "@/components/workstation/format";
import type { TaskRow } from "@/lib/tasks";
import { WEEK_ORDER, WEEKDAY_SHORT, formatMinute, type Slot } from "@/lib/workstation/routine";

export function OfficeTab({ tasks, slots }: { tasks: TaskRow[]; slots: Slot[] }) {
  const office = slots.filter((s) => s.kind === "OFFICE");
  const days = WEEK_ORDER.filter((d) => office.some((s) => s.weekday === d));
  const hours = office[0]
    ? `${formatMinute(office[0].startMin)}–${formatMinute(office[0].endMin)}`
    : null;
  const open = tasks.filter((t) => t.status !== "DONE").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-fg-muted">
          <Briefcase className="size-4" aria-hidden />
          {hours
            ? `Office ${hours}, ${days.map((d) => WEEKDAY_SHORT[d]).join(" ")}`
            : "No office hours in your routine"}
          {tasks.length > 0 ? ` · ${open} open` : ""}
        </p>
        <Link href="/tasks/new?category=office" className={primaryLink}>
          <Plus className="size-4" aria-hidden />
          New office task
        </Link>
      </div>
      {tasks.length === 0 ? (
        <EmptyState
          title="No office tasks"
          description="Keep work to-dos here, separate from study. They also appear in Tasks with an Office tag."
        />
      ) : (
        <TaskList tasks={tasks} />
      )}
    </div>
  );
}
