"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;
  return (
    <div className="enter mx-auto w-full max-w-page">
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-sm border border-danger/30 bg-danger-soft p-6"
      >
        <div>
          <h2 className="text-base font-medium text-fg">Something went wrong</h2>
          <p className="mt-1 text-sm text-fg-muted">
            This page couldn&apos;t load. Your data is safe — try again, and if it keeps happening,
            reload the app.
          </p>
          {digest ? <p className="mt-2 font-mono text-xs text-fg-subtle">Ref: {digest}</p> : null}
        </div>
        <Button variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
