"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { addDailySet } from "@/actions/daily-habits";
import { Button } from "@/components/ui/button";

/** Creates the built-in daily habits (prayer, exercise, … study) the user doesn't have yet. */
export function AddSetButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant={variant}
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await addDailySet();
            setMessage(
              r.error ??
                (r.added
                  ? `Added ${r.added} daily ${r.added === 1 ? "habit" : "habits"}.`
                  : "Your daily set is already there."),
            );
          })
        }
      >
        {pending ? null : <Plus className="size-4" aria-hidden />}
        Add my daily set
      </Button>
      {message ? (
        <p role="status" className="text-sm text-fg-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
