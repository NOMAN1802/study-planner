import type { Metadata } from "next";
import { createTask } from "@/actions/tasks";
import { TaskForm } from "@/components/tasks/task-form";
import { requireUser } from "@/lib/auth";
import { getLinkableHabits } from "@/lib/tasks";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  const { category } = await searchParams;
  const office = category === "office";
  const user = await requireUser();
  const habits = await getLinkableHabits(user.id);
  return (
    <div className="enter mx-auto w-full max-w-2xl">
      <h2 className="mb-5 font-display text-xl font-medium tracking-tight">
        {office ? "New office task" : "New task"}
      </h2>
      <div className="rounded-sm border border-border bg-surface p-4 sm:p-6">
        <TaskForm
          action={createTask}
          habits={habits}
          timezone={user.timezone}
          submitLabel="Create task"
          defaults={
            office
              ? {
                  title: "",
                  note: null,
                  status: "TODO",
                  priority: "MEDIUM",
                  dueLocal: "",
                  targetMinutes: null,
                  habitId: null,
                  category: "OFFICE",
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
