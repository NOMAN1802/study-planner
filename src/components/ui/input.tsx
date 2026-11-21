import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-sm border bg-surface px-3 text-sm text-fg transition-colors duration-150 placeholder:text-fg-subtle",
        "focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none",
        invalid ? "border-danger" : "border-border hover:border-border-strong",
        className,
      )}
    />
  );
}
