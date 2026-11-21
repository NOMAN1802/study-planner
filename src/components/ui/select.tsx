import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-sm border bg-surface px-3 text-sm text-fg transition-colors duration-150",
        "focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none",
        invalid ? "border-danger" : "border-border hover:border-border-strong",
        className,
      )}
    >
      {children}
    </select>
  );
}
