export const DEFAULT_TIMEZONE = "UTC";

/** Returns the timezone if it is a valid IANA name, otherwise the default. */
export function normalizeTimezone(value: string | null | undefined): string {
  if (!value) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
