import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-20 w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg transition-colors duration-150 placeholder:text-fg-subtle",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
        invalid ? "border-danger" : "border-border hover:border-border-strong",
        className,
      )}
    />
  );
}
