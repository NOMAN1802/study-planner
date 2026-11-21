import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { updateHabit } from "@/actions/habits";
import { HabitForm } from "@/components/habits/habit-form";
import { requireUser } from "@/lib/auth";
import type { Frequency } from "@/lib/dates";
import { getHabitForUser } from "@/lib/habits";

export const metadata: Metadata = { title: "Edit habit" };

export default async function EditHabitPage({ params }: PageProps<"/habits/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const habit = await getHabitForUser(user.id, id);
  if (!habit) notFound();

  return (
    <div className="enter mx-auto w-full max-w-2xl">
      <h2 className="mb-5 font-display text-xl font-medium tracking-tight">Edit habit</h2>
      <div className="rounded-sm border border-border bg-surface p-4 sm:p-6">
        <HabitForm
          action={updateHabit.bind(null, habit.id)}
          submitLabel="Save changes"
          defaults={{
            name: habit.name,
            note: habit.note,
            color: habit.color,
            icon: habit.icon,
            frequency: habit.frequency as Frequency,
            targetCount: habit.targetCount,
            targetMinutes: habit.targetMinutes,
            activeHours: habit.activeHours,
          }}
        />
      </div>
    </div>
  );
}
