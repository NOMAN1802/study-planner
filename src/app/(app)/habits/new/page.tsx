import type { Metadata } from "next";
import { createHabit } from "@/actions/habits";
import { HabitForm } from "@/components/habits/habit-form";

export const metadata: Metadata = { title: "New habit" };

export default function NewHabitPage() {
  return (
    <div className="enter mx-auto w-full max-w-2xl">
      <h2 className="mb-5 font-display text-xl font-medium tracking-tight">New habit</h2>
      <div className="rounded-sm border border-border bg-surface p-4 sm:p-6">
        <HabitForm action={createHabit} submitLabel="Create habit" />
      </div>
    </div>
  );
}
