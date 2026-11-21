"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setTopicDone } from "@/actions/workstation";

/** Checkbox that marks a lecture done (optimistic). */
export function TopicDone({ id, title, done }: { id: string; title: string; done: boolean }) {
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
            const r = await setTopicDone(id, !value);
            setError(r.error ?? null);
          })
        }
        aria-label={value ? `Mark ${title} as not done` : `Mark ${title} as done`}
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
