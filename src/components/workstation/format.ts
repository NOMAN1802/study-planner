import type { ItemKind } from "@/lib/workstation/schedule";

/** "Sat 21 Nov" for a day key (calendar date, timezone-free). */
export function formatDay(key: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...opts,
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export const KIND_TEXT: Record<ItemKind, string> = {
  topic: "Lecture",
  daily: "Vocabulary",
  "weekly-revision": "Weekly revision",
  "weekly-exam": "Weekly exam",
  "subject-revision": "Subject revision",
  "subject-final": "Subject final",
  revision: "Revision",
  mock: "Mock test",
};

export const isExam = (kind: ItemKind) =>
  kind === "weekly-exam" || kind === "subject-final" || kind === "mock";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const primaryLink =
  "inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong";
export const secondaryLink =
  "inline-flex h-8 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors duration-150 hover:bg-surface-2";
export const iconButton =
  "inline-flex size-8 items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent";
