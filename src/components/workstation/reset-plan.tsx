"use client";

import { useState, useTransition } from "react";
import { resetPlan } from "@/actions/workstation";
import { Button } from "@/components/ui/button";

export function ResetPlan() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirming)
    return (
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
        Reset plan
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-fg-muted">
        Delete the plan, its subjects, progress and exam scores?
      </span>
      <Button
        variant="danger"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await resetPlan();
            if (r.error) setError(r.error);
          })
        }
      >
        Delete plan
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
