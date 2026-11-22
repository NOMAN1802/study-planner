"use client";

import {
  CalendarDays,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Repeat,
  Settings,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS, activeChild, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const icons: Record<NavItem["icon"], typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  workstation: GraduationCap,
  habits: Repeat,
  money: Wallet,
  tasks: ListChecks,
  planner: CalendarDays,
  settings: Settings,
};

const rowClass = (active: boolean) =>
  cn(
    "relative flex h-9 w-full items-center gap-2.5 rounded-sm px-3 text-sm transition-colors duration-150",
    active
      ? "bg-surface-2 font-medium text-fg before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r before:bg-accent"
      : "text-fg-muted hover:bg-surface-2 hover:text-fg",
  );

function isActive(item: NavItem, pathname: string) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) =>
        item.children ? (
          <NavGroup key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ) : (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ),
      )}
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = icons[item.icon];
  const active = isActive(item, pathname);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={rowClass(active)}
    >
      <Icon className={cn("size-4", active ? "text-accent" : "")} aria-hidden />
      {item.label}
    </Link>
  );
}

/** An item with sub-pages: a button that opens a dropdown of links, open while on its pages. */
function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = icons[item.icon];
  const inside = isActive(item, pathname);
  const current = activeChild(item, pathname);
  const [open, setOpen] = useState(inside);
  // Entering the section from elsewhere opens it (state adjusted during render).
  const [wasInside, setWasInside] = useState(inside);
  if (inside !== wasInside) {
    setWasInside(inside);
    if (inside) setOpen(true);
  }
  const listId = `nav-${item.icon}`;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(rowClass(inside && !open), inside && "text-fg")}
      >
        <Icon className={cn("size-4", inside ? "text-accent" : "")} aria-hidden />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn("size-4 transition-transform duration-150", open ? "rotate-180" : "")}
          aria-hidden
        />
      </button>
      <ul id={listId} hidden={!open} className="mt-0.5 ml-[1.15rem] border-l border-border pl-2">
        {item.children?.map((child) => {
          const active = child === current;
          return (
            <li key={child.href}>
              <Link
                href={child.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-sm px-3 text-sm transition-colors duration-150",
                  active
                    ? "bg-surface-2 font-medium text-fg"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {child.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
