import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** A static placeholder block. Deliberately not animated (no looping motion). */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("rounded bg-surface-3", className)} style={style} aria-hidden />;
}

/** Placeholder for the form pages (new/edit habit, new/edit task, settings). */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="mx-auto w-full max-w-2xl" role="status" aria-label="Loading">
      <Skeleton className="mb-5 h-7 w-40" />
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-6">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full bg-surface-2" />
          </div>
        ))}
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
