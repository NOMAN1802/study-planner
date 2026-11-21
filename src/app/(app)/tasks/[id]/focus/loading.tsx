import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-page flex-col gap-4"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col items-center gap-6 rounded-sm border border-border bg-surface p-8">
          <Skeleton className="size-56 rounded-full bg-surface-2" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full bg-surface-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
