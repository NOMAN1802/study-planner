"use client";

import { LayoutGroup, motion, MotionConfig } from "motion/react";
import { useState, useTransition } from "react";
import { reorderHabits } from "@/actions/habits";
import { HabitRow } from "@/components/habits/habit-row";
import type { HabitRow as HabitRowData } from "@/lib/habits";

/** Active habits with check-in and keyboard-accessible reordering. */
export function HabitList({ habits }: { habits: HabitRowData[] }) {
  const [order, setOrder] = useState(() => habits.map((h) => h.id));
  const [source, setSource] = useState(habits);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  // New data from the server (after any mutation): adopt its order.
  if (source !== habits) {
    setSource(habits);
    setOrder(habits.map((h) => h.id));
  }

  const byId = new Map(habits.map((h) => [h.id, h]));
  const rows = order.map((id) => byId.get(id)).filter((h): h is HabitRowData => Boolean(h));

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const previous = order;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setError(null);
    startTransition(async () => {
      const result = await reorderHabits(next);
      if (result.error) {
        setOrder(previous);
        setError(result.error);
      }
    });
  }

  return (
    <MotionConfig reducedMotion="user">
      {error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {saving ? "Saving order…" : ""}
      </p>
      <LayoutGroup>
        <ul className="flex flex-col gap-2" aria-label="Habits" aria-busy={saving || undefined}>
          {rows.map((habit, index) => (
            <motion.li
              key={habit.id}
              layout="position"
              transition={{ duration: 0.2, ease: "easeOut" }}
              data-testid="habit-row"
            >
              <HabitRow
                habit={habit}
                isFirst={index === 0}
                isLast={index === rows.length - 1}
                onMove={(direction) => move(index, direction)}
              />
            </motion.li>
          ))}
        </ul>
      </LayoutGroup>
    </MotionConfig>
  );
}
