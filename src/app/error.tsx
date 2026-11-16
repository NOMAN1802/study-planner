"use client";

import { Button } from "@/components/ui/button";

/** Fallback for errors outside the signed-in app (sign-in, sign-up, redirects). */
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <div
        role="alert"
        className="enter flex max-w-md flex-col items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-6"
      >
        <h1 className="text-base font-medium text-fg">Something went wrong</h1>
        <p className="text-sm text-fg-muted">
          This page couldn&apos;t load. Try again, and if it keeps happening, reload the app.
        </p>
        <Button variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </main>
  );
}
