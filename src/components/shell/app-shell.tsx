"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { pageTitle } from "@/lib/nav";
import { cn } from "@/lib/utils";

type AppShellProps = {
  email: string;
  userMenu: ReactNode;
  children: ReactNode;
};

export function AppShell({ email, userMenu, children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const title = pageTitle(pathname);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Mobile drawer: move focus in when it opens, back to the trigger when it
  // closes, and let Escape close it.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      sidebarRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      menuButtonRef.current?.focus();
    }
  }, [open]);

  // Close the mobile drawer whenever the route changes (state adjusted during render).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#main"
        className="sr-only rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        className={cn(
          // Closed on mobile: slid away and `invisible`, so its links leave the tab order.
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface duration-200 ease-out md:visible md:static md:translate-x-0",
          // Visibility only transitions on the way out, so focus can move in immediately.
          open
            ? "visible translate-x-0 transition-transform"
            : "invisible -translate-x-full transition-[translate,visibility]",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="font-display text-base font-semibold tracking-tight">Habit Tracker</span>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-border p-3">
          <p className="truncate px-2 text-xs text-fg-muted" title={email}>
            {email}
          </p>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg px-4 sm:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:bg-surface-2 md:hidden"
            aria-label="Open menu"
            aria-controls="app-sidebar"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-4" aria-hidden />
          </button>
          <h1 className="font-display text-lg font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {userMenu}
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
