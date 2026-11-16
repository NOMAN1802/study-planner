import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-md border bg-surface px-2.5 text-sm text-fg transition-colors duration-150",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
        invalid ? "border-danger" : "border-border hover:border-border-strong",
        className,
      )}
    >
      {children}
    </select>
  );
}
