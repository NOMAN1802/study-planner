import { Skeleton } from "@/components/ui/skeleton";

const panel = "rounded-sm border border-border bg-surface";

function PanelSkeleton({ className, rows = 3 }: { className?: string; rows?: number }) {
  return (
    <div className={`${panel} ${className ?? ""}`}>
      <div className="flex h-11 items-center border-b border-border px-4">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-sm" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-1.5 w-3/5 rounded-full bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div
      className="mx-auto grid w-full max-w-page gap-4 lg:grid-cols-5"
      role="status"
      aria-label="Loading"
    >
      <PanelSkeleton className="lg:col-span-5" />
      <PanelSkeleton className="lg:col-span-2" rows={2} />
      <div className={`${panel} lg:col-span-3`}>
        <div className="flex h-11 items-center border-b border-border px-4">
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex h-56 items-end gap-3 p-4">
          {[40, 70, 30, 85, 55, 20, 60].map((h, i) => (
            <Skeleton key={i} className="flex-1 bg-surface-2" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className={`${panel} lg:col-span-5`}>
        <div className="flex h-11 items-center border-b border-border px-4">
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="p-4">
          <Skeleton className="h-28 w-full bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
