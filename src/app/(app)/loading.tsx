export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-page flex-col gap-2"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="flex h-16 items-center gap-3 rounded-sm border border-border bg-surface px-4"
        >
          <div className="size-8 rounded-sm bg-surface-3" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-40 rounded-sm bg-surface-3" />
            <div className="h-1.5 w-48 rounded-full bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
