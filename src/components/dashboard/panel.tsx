import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = {
  id: string;
  title: string;
  /** Right-aligned header content (summary number, controls). */
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Position in the entrance stagger. */
  index?: number;
  children: ReactNode;
};

export function Panel({
  id,
  title,
  aside,
  className,
  bodyClassName,
  index = 0,
  children,
}: PanelProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      data-testid={`panel-${id}`}
      style={{ "--enter-index": index } as CSSProperties}
      className={cn(
        "enter flex min-w-0 flex-col rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-1.5">
        <h2 id={`${id}-title`} className="text-sm font-medium text-fg">
          {title}
        </h2>
        {aside ? <div className="text-xs text-fg-muted">{aside}</div> : null}
      </header>
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
