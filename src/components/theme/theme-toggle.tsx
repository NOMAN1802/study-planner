"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes resolves the theme on the client only; avoid a hydration mismatch.
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )
      ) : (
        <span className="size-4" aria-hidden />
      )}
    </button>
  );
}
