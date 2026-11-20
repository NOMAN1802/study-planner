export type NavItem = {
  href: "/dashboard" | "/work-station" | "/habits" | "/tasks" | "/planner" | "/settings";
  label: string;
  icon: "dashboard" | "workstation" | "habits" | "tasks" | "planner" | "settings";
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/work-station", label: "Study Station", icon: "workstation" },
  { href: "/habits", label: "Habits", icon: "habits" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/planner", label: "Planner", icon: "planner" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

export function pageTitle(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Habit Tracker";
}
