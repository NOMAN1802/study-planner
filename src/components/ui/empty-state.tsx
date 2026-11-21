import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-sm border border-dashed border-border-strong bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-fg">{title}</h2>
        <p className="max-w-prose text-sm text-fg-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
