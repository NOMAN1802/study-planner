/** Formatting helpers shared by planner components (client and server safe). */

export function timeFormatter(timezone: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (ms: number) => f.format(ms);
}

/** Labels for a local date key; formatted in UTC because the key already is the local date. */
export function dayKeyLabel(
  key: string,
  style: "short" | "long" | "weekday" | "month" = "short",
): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const opts: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : style === "weekday"
        ? { weekday: "short", day: "numeric" }
        : style === "month"
          ? { month: "long", year: "numeric" }
          : { weekday: "short", day: "numeric", month: "short" };
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" })
    .format(date)
    .replace(",", "");
}

export function blockColor(color: string | null): string {
  return color ?? "var(--accent)";
}

export const PALETTE_MIME = "application/x-planner-item";
export const BLOCK_MIME = "application/x-planner-block";
