import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border px-4 sm:px-6">
        <span className="font-display text-base font-semibold tracking-tight">Habit Tracker</span>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <div className="enter flex max-w-md flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
          <p className="font-mono text-xs text-fg-muted">404</p>
          <h1 className="font-display text-xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-sm text-fg-muted">
            There is nothing at this address. Check the link, or go back to your dashboard.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
