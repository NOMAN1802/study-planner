"use client";

import { useSyncExternalStore } from "react";

/** Per-device preference for phase-end alerts (stored in localStorage). */
export type AlertPrefs = { sound: boolean; notify: boolean };

const KEY = "pomodoro:alerts";
const EVENT = "pomodoro:alerts-change";
const DEFAULT: AlertPrefs = { sound: false, notify: false };
let cachedRaw: string | null | undefined;
let cached: AlertPrefs = DEFAULT;

function read(): AlertPrefs {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<AlertPrefs>) : {};
    cached = { sound: parsed.sound === true, notify: parsed.notify === true };
  } catch {
    cached = DEFAULT;
  }
  return cached;
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useAlertPrefs(): [AlertPrefs, (next: AlertPrefs) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const set = (next: AlertPrefs) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode); the preference just won't persist.
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [prefs, set];
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Two short tones generated with Web Audio; no audio file needed. */
export function playChime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.22;
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.21);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Audio is best-effort.
  }
}

export function showNotification(title: string, body: string): void {
  try {
    if (notificationsSupported() && Notification.permission === "granted") {
      new Notification(title, { body, tag: "pomodoro" });
    }
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}
