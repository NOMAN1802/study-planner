import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip } from "@/components/workstation/ws-header";

export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-page flex-col gap-4"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <StatStrip>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-surface px-4 py-3 sm:px-5 sm:py-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </StatStrip>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-surface-2" />
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full bg-surface-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
