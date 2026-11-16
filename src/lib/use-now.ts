"use client";

import { useEffect, useState } from "react";

/**
 * Current time, refreshed every `intervalMs` while active and whenever the tab
 * becomes visible again (background tabs throttle intervals). Pass null to stop.
 * Used only for display; correctness never depends on how often this fires.
 */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs === null) return;
    const update = () => setNow(Date.now());
    const id = setInterval(update, intervalMs);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [intervalMs]);
  return now;
}
