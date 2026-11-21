"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setItemDone } from "@/actions/workstation";

/** Checkbox that ticks a vocabulary or revision item of today's plan (optimistic). */
export function ItemDone({
  itemKey,
  cycles,
  label,
  done,
}: {
  itemKey: string;
  cycles: number;
  label: string;
  done: boolean;
}) {
  const [value, setValue] = useOptimistic(done);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  return (
    <>
      <input
        type="checkbox"
        checked={value}
        onChange={() =>
          start(async () => {
            setValue(!value);
            const r = await setItemDone(itemKey, cycles, !value);
            setError(r.error ?? null);
          })
        }
        aria-label={value ? `Mark ${label} as not done` : `Mark ${label} as done`}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm accent-(--accent)"
      />
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
