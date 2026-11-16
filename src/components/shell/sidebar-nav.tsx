"use client";

import {
  BriefcaseBusiness,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Repeat,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const icons: Record<NavItem["icon"], typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  workstation: BriefcaseBusiness,
  habits: Repeat,
  tasks: ListChecks,
  planner: CalendarDays,
  settings: Settings,
};

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = icons[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150",
              active
                ? "bg-surface-2 font-medium text-fg"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className={cn("size-4", active ? "text-accent" : "")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
