import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskList } from "@/components/tasks/task-list";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { countTasks, getTaskRows } from "@/lib/tasks";
import { parseTaskFilters } from "@/schemas/task";

export const metadata: Metadata = { title: "Tasks" };

const primaryLink =
  "inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong";

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const filters = parseTaskFilters(await searchParams);
  const user = await requireUser();
  const [tasks, total] = await Promise.all([getTaskRows(user, filters), countTasks(user.id)]);

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TaskFilters filters={filters} />
        <Link href="/tasks/new" className={primaryLink}>
          <Plus className="size-4" aria-hidden />
          New task
        </Link>
      </div>

      {total === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add a task with a priority, a due date and a time budget. You can link it to a habit so focus time counts toward both."
          action={
            <Link href="/tasks/new" className={primaryLink}>
              <Plus className="size-4" aria-hidden />
              Create your first task
            </Link>
          }
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks match these filters"
          description="Try a different status or due date, or reset the filters."
          action={
            <Link href="/tasks" className="text-sm font-medium text-accent hover:underline">
              Reset filters
            </Link>
          }
        />
      ) : (
        <>
          <TaskList tasks={tasks} />
          <p className="text-xs text-fg-subtle" role="status">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </p>
        </>
      )}
    </div>
  );
}
