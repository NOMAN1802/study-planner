import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <span className="font-display text-base font-semibold tracking-tight">Habit Tracker</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        <div className="enter w-full max-w-sm rounded-lg border border-border bg-surface p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
