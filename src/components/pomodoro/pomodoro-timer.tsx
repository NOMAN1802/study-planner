"use client";

import { Bell, BellOff, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { runTimer, type TimerCommand } from "@/actions/pomodoro";
import {
  playChime,
  requestNotificationPermission,
  showNotification,
  useAlertPrefs,
} from "@/lib/alerts";
import {
  PHASE_LABEL,
  endsAt,
  formatClock,
  plannedMinutesFor,
  plannedMs,
  remainingMs,
  stateFromPersisted,
  type Phase,
} from "@/lib/pomodoro";
import type { TimerSnapshot } from "@/lib/pomodoro-server";
import { useMounted } from "@/lib/use-mounted";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

type PomodoroTimerProps = {
  taskTitle: string;
  initial: TimerSnapshot;
  /** Study Station topic to record on sessions started here. */
  topicId?: string | null;
};

const RING = 2 * Math.PI * 54;

export function PomodoroTimer({ taskTitle, initial, topicId = null }: PomodoroTimerProps) {
  const [snap, setSnap] = useState(initial);
  const [source, setSource] = useState(initial);
  // Server clock minus client clock, so client "now" matches the server's timestamps.
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [prefs, setPrefs] = useAlertPrefs();
  const mounted = useMounted();
  const completing = useRef(false);

  // The page re-rendered with fresh server data (e.g. settings saved): adopt it.
  if (source !== initial) {
    setSource(initial);
    setSnap(initial);
  }

  const active = snap.active;
  const running = active !== null && active.pausedAt === null;
  const clientNow = useNow(running ? 250 : null);
  // Before hydration, render with the server's clock so markup matches.
  const now = mounted ? clientNow + offset : snap.serverNow;
  const state = stateFromPersisted({ ...snap, now });

  function apply(result: { snapshot?: TimerSnapshot; error?: string }, receivedAt: number) {
    if (result.snapshot) {
      setSnap(result.snapshot);
      setSource((s) => s); // keep source; only server re-renders replace it
      setOffset(result.snapshot.serverNow - receivedAt);
    }
    setError(result.error ?? null);
  }

  function send(command: TimerCommand) {
    startTransition(async () => {
      const before = snap;
      const result = await runTimer(snap.taskId, command, command === "START" ? topicId : null);
      apply(result, Date.now());
      if (
        command === "COMPLETE" &&
        result.snapshot &&
        before.active &&
        result.snapshot.active?.id !== before.active.id
      ) {
        const finished = before.active.type;
        const title = finished === "FOCUS" ? "Focus complete" : `${PHASE_LABEL[finished]} over`;
        const body =
          finished === "FOCUS"
            ? `Nice work on “${taskTitle}”. Time for a break.`
            : `Back to “${taskTitle}”.`;
        if (prefs.sound) playChime();
        if (prefs.notify) showNotification(title, body);
      }
    });
  }

  // Schedule completion for the exact end time; also re-check when the tab
  // becomes visible (background timers may have been throttled).
  const end = active ? endsAt(active) : null;
  useEffect(() => {
    if (end === null) return;
    completing.current = false;
    const fire = () => {
      if (completing.current) return;
      if (Date.now() + offset >= end) {
        completing.current = true;
        send("COMPLETE");
      }
    };
    const timeout = setTimeout(fire, Math.max(0, end - (Date.now() + offset)) + 50);
    document.addEventListener("visibilitychange", fire);
    fire();
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", fire);
    };
    // `send` is stable enough for this purpose; re-run only when the end moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, offset]);

  // Show the countdown in the tab title.
  const session =
    state.status === "focus" || state.status === "break" || state.status === "paused"
      ? state.session
      : null;
  const remaining = session ? remainingMs(session, now) : null;
  const clock = session
    ? formatClock(remaining as number)
    : formatClock(plannedMinutesFor(nextOf(state), snap.settings) * 60_000);
  useEffect(() => {
    if (!session) return;
    const previous = document.title;
    document.title = `${clock} · ${PHASE_LABEL[session.type]}${state.status === "paused" ? " (paused)" : ""}`;
    return () => {
      document.title = previous;
    };
  }, [clock, session, state.status]);

  const phase: Phase = session ? session.type : nextOf(state);
  const progress = session ? 1 - (remaining as number) / plannedMs(session) : 0;
  const cycles = snap.settings.cyclesBeforeLongBreak;
  const filled = Math.min(
    state.cycleCount % cycles === 0 && state.cycleCount > 0 ? cycles : state.cycleCount % cycles,
    cycles,
  );

  const headline =
    state.status === "done"
      ? `${PHASE_LABEL[state.finished]} complete`
      : state.status === "paused"
        ? `${PHASE_LABEL[phase]} · paused`
        : session
          ? PHASE_LABEL[phase]
          : `Ready for ${PHASE_LABEL[phase].toLowerCase()}`;

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="timer-heading"
        className="flex flex-col items-center gap-5 rounded-lg border border-border bg-surface px-4 py-6 sm:py-8"
      >
        {snap.otherActive ? (
          <p
            role="status"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted"
          >
            A timer is running on{" "}
            <Link
              href={`/tasks/${snap.otherActive.taskId}/focus`}
              className="font-medium text-accent hover:underline"
            >
              {snap.otherActive.title}
            </Link>
            . Finish or skip it before starting one here.
          </p>
        ) : null}

        <h2
          id="timer-heading"
          className="text-sm font-medium text-fg-muted"
          data-testid="timer-phase"
        >
          {headline}
        </h2>

        <div className="relative size-52 sm:size-60">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="6"
              className="stroke-surface-3"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={phase === "FOCUS" ? "stroke-accent" : "stroke-warning"}
              strokeDasharray={RING}
              initial={false}
              animate={{ strokeDashoffset: RING * (1 - progress) }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-mono text-5xl font-medium tracking-tight text-fg tabular-nums sm:text-6xl"
              data-testid="timer-remaining"
              role="timer"
              aria-label={`${clock} remaining`}
            >
              {clock}
            </span>
            <span className="mt-1 text-xs text-fg-muted">
              {plannedMinutesFor(phase, snap.settings)} min {PHASE_LABEL[phase].toLowerCase()}
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5"
          aria-label={`${state.cycleCount % cycles || (state.cycleCount ? cycles : 0)} of ${cycles} focus sessions before a long break`}
          role="img"
        >
          {Array.from({ length: cycles }, (_, i) => (
            <span
              key={i}
              className={cn(
                "size-2 rounded-full transition-colors duration-200",
                i < filled ? "bg-accent" : "bg-surface-3",
              )}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {state.status === "idle" || state.status === "done" ? (
            <button
              type="button"
              onClick={() => send("START")}
              disabled={pending || Boolean(snap.otherActive)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="size-4" aria-hidden />
              Start {PHASE_LABEL[phase].toLowerCase()}
            </button>
          ) : state.status === "paused" ? (
            <button
              type="button"
              onClick={() => send("RESUME")}
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong disabled:opacity-60"
            >
              <Play className="size-4" aria-hidden />
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send("PAUSE")}
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-5 text-sm font-medium text-fg transition-colors duration-150 hover:bg-surface-2 disabled:opacity-60"
            >
              <Pause className="size-4" aria-hidden />
              Pause
            </button>
          )}
          {session ? (
            <button
              type="button"
              onClick={() => send("SKIP")}
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-60"
            >
              <SkipForward className="size-4" aria-hidden />
              Skip
            </button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-1 border-t border-border pt-4 text-xs text-fg-muted">
          <button
            type="button"
            aria-pressed={prefs.sound}
            onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 transition-colors duration-150 hover:bg-surface-2 hover:text-fg aria-pressed:text-fg"
          >
            {prefs.sound ? (
              <Volume2 className="size-3.5" aria-hidden />
            ) : (
              <VolumeX className="size-3.5" aria-hidden />
            )}
            Sound {prefs.sound ? "on" : "off"}
          </button>
          <button
            type="button"
            aria-pressed={prefs.notify}
            onClick={async () => {
              if (prefs.notify) return setPrefs({ ...prefs, notify: false });
              const granted = await requestNotificationPermission();
              if (!granted)
                setError(
                  "Notifications are blocked in this browser. Allow them in site settings to use this.",
                );
              setPrefs({ ...prefs, notify: granted });
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 transition-colors duration-150 hover:bg-surface-2 hover:text-fg aria-pressed:text-fg"
          >
            {prefs.notify ? (
              <Bell className="size-3.5" aria-hidden />
            ) : (
              <BellOff className="size-3.5" aria-hidden />
            )}
            Notifications {prefs.notify ? "on" : "off"}
          </button>
        </div>
      </section>
    </MotionConfig>
  );
}

function nextOf(state: ReturnType<typeof stateFromPersisted>): Phase {
  return state.status === "idle" || state.status === "done" ? state.next : state.session.type;
}
