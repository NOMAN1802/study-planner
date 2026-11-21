import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArchivedList } from "@/components/habits/archived-list";
import { HabitList } from "@/components/habits/habit-list";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getHabitRows, type HabitView } from "@/lib/habits";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Habits" };

const primaryLink =
  "inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong";

export default async function HabitsPage({ searchParams }: PageProps<"/habits">) {
  const { view: viewParam } = await searchParams;
  const view: HabitView = viewParam === "archived" ? "archived" : "active";
  const user = await requireUser();
  const habits = await getHabitRows(user, view);

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <nav
          aria-label="Habit views"
          className="inline-flex rounded-sm border border-border bg-surface p-0.5"
        >
          {(["active", "archived"] as const).map((v) => (
            <Link
              key={v}
              href={v === "active" ? "/habits" : "/habits?view=archived"}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-sm px-3 text-sm capitalize transition-colors duration-150",
                view === v ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {v}
            </Link>
          ))}
        </nav>
        <Link href="/habits/new" className={primaryLink}>
          <Plus className="size-4" aria-hidden />
          New habit
        </Link>
      </div>

      {habits.length === 0 ? (
        view === "active" ? (
          <EmptyState
            title="No habits yet"
            description="Create a habit to start tracking check-ins and streaks. Habits can repeat every hour, day, week or month."
            action={
              <Link href="/habits/new" className={primaryLink}>
                <Plus className="size-4" aria-hidden />
                Create your first habit
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No archived habits"
            description="Habits you archive are kept here with their history, and can be restored at any time."
          />
        )
      ) : view === "active" ? (
        <HabitList habits={habits} />
      ) : (
        <ArchivedList habits={habits} />
      )}
    </div>
  );
}
