export type NavChild = { href: string; label: string };

export type NavItem = {
  href: "/dashboard" | "/work-station" | "/habits" | "/money" | "/tasks" | "/planner" | "/settings";
  label: string;
  icon: "dashboard" | "workstation" | "habits" | "money" | "tasks" | "planner" | "settings";
  /** Sub-pages, shown as a dropdown under the item. */
  children?: readonly NavChild[];
};

/** Study Station's pages, each its own route. */
export const STATION_PAGES = [
  { href: "/work-station", label: "Today" },
  { href: "/work-station/subjects", label: "Subjects" },
  { href: "/work-station/routine", label: "Routine" },
  { href: "/work-station/plan", label: "Plan" },
  { href: "/work-station/exams", label: "Exams" },
  { href: "/work-station/archived", label: "Archived" },
  { href: "/work-station/office", label: "Office" },
] as const satisfies readonly NavChild[];

/** Habits' pages: the list, the daily checklist, the month grid and the report. */
export const HABIT_PAGES = [
  { href: "/habits", label: "All habits" },
  { href: "/habits/daily", label: "Daily" },
  { href: "/habits/tracker", label: "Tracker" },
  { href: "/habits/report", label: "Report" },
] as const satisfies readonly NavChild[];

/** Money's pages. */
export const MONEY_PAGES = [
  { href: "/money", label: "Overview" },
  { href: "/money/transactions", label: "Transactions" },
  { href: "/money/debts", label: "Borrow & Lend" },
  { href: "/money/savings", label: "Savings" },
  { href: "/money/report", label: "Report" },
  { href: "/money/settings", label: "Accounts & budgets" },
] as const satisfies readonly NavChild[];

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/work-station", label: "Study Station", icon: "workstation", children: STATION_PAGES },
  { href: "/habits", label: "Habits", icon: "habits", children: HABIT_PAGES },
  { href: "/money", label: "Money", icon: "money", children: MONEY_PAGES },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/planner", label: "Planner", icon: "planner" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The child page `pathname` belongs to: the longest matching href, where a
 * child sharing its parent's href (Today) only matches exactly. Exam sittings
 * and practice belong to Exams; new and edit habit pages belong to All habits.
 */
export function activeChild(item: NavItem, pathname: string): NavChild | undefined {
  if (!item.children) return undefined;
  if (item.href === "/habits" && /^\/habits\/(new|[0-9a-f-]{36})(\/|$)/.test(pathname))
    return item.children[0];
  if (item.href === "/work-station" && /^\/work-station\/(exam|practice)(\/|$)/.test(pathname))
    return item.children.find((c) => c.href === "/work-station/exams");
  return item.children
    .filter((c) => (c.href === item.href ? pathname === c.href : matches(pathname, c.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function pageTitle(pathname: string): string {
  const match = NAV_ITEMS.find((item) => matches(pathname, item.href));
  return match?.label ?? "Habit Tracker";
}
