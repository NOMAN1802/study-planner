"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function readBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/** Hidden field carrying the browser's IANA timezone so the Profile can be created with it. */
export function TimezoneInput() {
  // Server snapshot is empty; the client snapshot fills in after hydration.
  const timezone = useSyncExternalStore(subscribe, readBrowserTimezone, () => "");
  return <input type="hidden" name="timezone" value={timezone} readOnly />;
}
