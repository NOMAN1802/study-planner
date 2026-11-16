import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-4"
      role="status"
      aria-label="Loading"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full bg-surface-2" />
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="h-10 border-b border-border" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex h-12 items-start gap-3 border-b border-border px-3 pt-2">
              <Skeleton className="h-2.5 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
