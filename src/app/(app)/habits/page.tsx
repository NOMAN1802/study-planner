import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AddSetButton } from "@/components/daily-habits/add-set-button";
import { ArchivedList } from "@/components/habits/archived-list";
import { HabitList } from "@/components/habits/habit-list";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { hasDailySet } from "@/lib/daily-habits-server";
import { getHabitRows, type HabitView } from "@/lib/habits";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Habits" };

const primaryLink =
  "inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong";

export default async function HabitsPage({ searchParams }: PageProps<"/habits">) {
  const { view: viewParam } = await searchParams;
  const view: HabitView = viewParam === "archived" ? "archived" : "active";
  const user = await requireUser();
  const [habits, hasSet] = await Promise.all([getHabitRows(user, view), hasDailySet(user.id)]);

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

      {view === "active" && !hasSet ? (
        <div className="flex flex-col gap-2 rounded-sm border border-dashed border-border-strong bg-surface p-4">
          <p className="text-sm text-fg-muted">
            Daily set: Prayer (Fajr, Dhuhr, Asr, Maghrib, Isha), Exercise 5 min, Bath before Fajr,
            No sugar, Screen time under 2 hours, No junk food, Learn a new technology, Read Quran 10
            min, Sleep 11 pm – 5 am, Study at least 7 hours.
          </p>
          <AddSetButton variant="secondary" />
        </div>
      ) : null}

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
