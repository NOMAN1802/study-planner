/**
 * Pomodoro timer state machine. Pure: no I/O, no clocks — every function takes
 * `now` (epoch ms). Remaining time is always derived from timestamps, never
 * from counting ticks, so it stays correct across reloads and throttled tabs.
 */

export type Phase = "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  autoStartNext: boolean;
};

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
  autoStartNext: false,
};

export const MINUTE_MS = 60_000;
/** A finished phase older than this is not shown as "done"; the next start is a fresh run. */
export const RUN_GAP_MS = 60 * MINUTE_MS;

export type ActiveSession = {
  id: string;
  type: Phase;
  plannedMinutes: number;
  startedAt: number;
  /** Non-null while paused. */
  pausedAt: number | null;
  /** Total time spent paused before `pausedAt`. */
  pausedMs: number;
};

export type TimerState =
  | { status: "idle"; next: Phase; cycleCount: number }
  | { status: "focus" | "break"; session: ActiveSession; cycleCount: number }
  | { status: "paused"; session: ActiveSession; cycleCount: number }
  | { status: "done"; finished: Phase; next: Phase; cycleCount: number };

export type TimerEvent =
  | { type: "START"; id: string; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number }
  | { type: "SKIP"; now: number }
  /** Periodic check; completes the phase if its time is up. `nextId` enables auto-start. */
  | { type: "TICK"; now: number; nextId?: string };

export class InvalidTransitionError extends Error {
  constructor(status: TimerState["status"], event: TimerEvent["type"]) {
    super(`Cannot ${event.toLowerCase()} while ${status}`);
    this.name = "InvalidTransitionError";
  }
}

export function plannedMinutesFor(phase: Phase, s: PomodoroSettings): number {
  if (phase === "FOCUS") return s.focusMinutes;
  if (phase === "SHORT_BREAK") return s.shortBreakMinutes;
  return s.longBreakMinutes;
}

export const statusFor = (phase: Phase): "focus" | "break" =>
  phase === "FOCUS" ? "focus" : "break";

export function plannedMs(session: Pick<ActiveSession, "plannedMinutes">): number {
  return session.plannedMinutes * MINUTE_MS;
}

/** Time actually spent in the phase (excludes pauses), clamped to [0, planned]. */
export function elapsedMs(session: ActiveSession, now: number): number {
  const until = session.pausedAt ?? now;
  const raw = until - session.startedAt - session.pausedMs;
  return Math.min(Math.max(raw, 0), plannedMs(session));
}

export function remainingMs(session: ActiveSession, now: number): number {
  return plannedMs(session) - elapsedMs(session, now);
}

/** Wall-clock end of a running phase; null while paused. */
export function endsAt(session: ActiveSession): number | null {
  if (session.pausedAt !== null) return null;
  return session.startedAt + session.pausedMs + plannedMs(session);
}

export function isFinished(session: ActiveSession, now: number): boolean {
  const end = endsAt(session);
  return end !== null && now >= end;
}

/** Completed focus sessions in the current cycle after a phase ends. */
export function cycleCountAfter(finished: Phase, completed: boolean, count: number): number {
  if (finished === "LONG_BREAK") return 0;
  if (finished === "FOCUS" && completed) return count + 1;
  return count;
}

/** Which phase follows. `countAfter` is the value from `cycleCountAfter`. */
export function nextPhase(
  finished: Phase,
  completed: boolean,
  countAfter: number,
  s: PomodoroSettings,
): Phase {
  if (finished !== "FOCUS") return "FOCUS";
  if (!completed) return "SHORT_BREAK";
  return countAfter > 0 && countAfter % s.cyclesBeforeLongBreak === 0
    ? "LONG_BREAK"
    : "SHORT_BREAK";
}

/** Whole focus minutes to credit when a phase ends. Breaks earn nothing. */
export function focusCreditMinutes(
  session: ActiveSession,
  now: number,
  completed: boolean,
): number {
  if (session.type !== "FOCUS") return 0;
  if (completed) return session.plannedMinutes;
  return Math.floor(elapsedMs(session, now) / MINUTE_MS);
}

function newSession(
  id: string,
  type: Phase,
  startedAt: number,
  s: PomodoroSettings,
): ActiveSession {
  return {
    id,
    type,
    plannedMinutes: plannedMinutesFor(type, s),
    startedAt,
    pausedAt: null,
    pausedMs: 0,
  };
}

export function transition(state: TimerState, event: TimerEvent, s: PomodoroSettings): TimerState {
  switch (event.type) {
    case "START": {
      if (state.status !== "idle" && state.status !== "done")
        throw new InvalidTransitionError(state.status, "START");
      const session = newSession(event.id, state.next, event.now, s);
      return { status: statusFor(session.type), session, cycleCount: state.cycleCount };
    }
    case "PAUSE": {
      if (state.status !== "focus" && state.status !== "break")
        throw new InvalidTransitionError(state.status, "PAUSE");
      if (isFinished(state.session, event.now)) throw new InvalidTransitionError("done", "PAUSE");
      return {
        status: "paused",
        session: { ...state.session, pausedAt: event.now },
        cycleCount: state.cycleCount,
      };
    }
    case "RESUME": {
      if (state.status !== "paused" || state.session.pausedAt === null) {
        throw new InvalidTransitionError(state.status, "RESUME");
      }
      const pausedFor = Math.max(0, event.now - state.session.pausedAt);
      const session = {
        ...state.session,
        pausedAt: null,
        pausedMs: state.session.pausedMs + pausedFor,
      };
      return { status: statusFor(session.type), session, cycleCount: state.cycleCount };
    }
    case "SKIP": {
      if (state.status !== "focus" && state.status !== "break" && state.status !== "paused") {
        throw new InvalidTransitionError(state.status, "SKIP");
      }
      const type = state.session.type;
      const count = cycleCountAfter(type, false, state.cycleCount);
      return { status: "idle", next: nextPhase(type, false, count, s), cycleCount: count };
    }
    case "TICK": {
      // Ticks are harmless no-ops unless a running phase has run out.
      if (
        (state.status !== "focus" && state.status !== "break") ||
        !isFinished(state.session, event.now)
      ) {
        return state;
      }
      const type = state.session.type;
      const count = cycleCountAfter(type, true, state.cycleCount);
      const next = nextPhase(type, true, count, s);
      if (s.autoStartNext && event.nextId) {
        // Start the next phase at the exact end of this one, not "now", so time
        // spent in a background tab is not lost.
        const session = newSession(event.nextId, next, endsAt(state.session) as number, s);
        return { status: statusFor(next), session, cycleCount: count };
      }
      return { status: "done", finished: type, next, cycleCount: count };
    }
  }
}

export type PastSession = {
  type: Phase;
  completed: boolean;
  startedAt: number;
  endedAt: number;
};

/**
 * Completed focus sessions in the current run, from the most recent ended
 * sessions (newest first). A run ends at a long break or a gap > RUN_GAP_MS.
 */
export function cycleCountFrom(sessionsNewestFirst: readonly PastSession[]): number {
  let count = 0;
  let laterStart: number | null = null;
  for (const s of sessionsNewestFirst) {
    if (laterStart !== null && laterStart - s.endedAt > RUN_GAP_MS) break;
    if (s.type === "LONG_BREAK") break;
    if (s.type === "FOCUS" && s.completed) count += 1;
    laterStart = s.startedAt;
  }
  return count;
}

/** Rebuilds the machine state from persisted data. */
export function stateFromPersisted(input: {
  active: ActiveSession | null;
  last: PastSession | null;
  cycleCount: number;
  settings: PomodoroSettings;
  now: number;
}): TimerState {
  const { active, last, settings, now } = input;
  if (active) {
    return {
      status: active.pausedAt !== null ? "paused" : statusFor(active.type),
      session: active,
      cycleCount: input.cycleCount,
    };
  }
  if (!last || now - last.endedAt > RUN_GAP_MS) {
    return { status: "idle", next: "FOCUS", cycleCount: last ? input.cycleCount : 0 };
  }
  const next = nextPhase(last.type, last.completed, input.cycleCount, settings);
  return last.completed
    ? { status: "done", finished: last.type, next, cycleCount: input.cycleCount }
    : { status: "idle", next, cycleCount: input.cycleCount };
}

export const PHASE_LABEL: Record<Phase, string> = {
  FOCUS: "Focus",
  SHORT_BREAK: "Short break",
  LONG_BREAK: "Long break",
};

/** mm:ss, rounding up so the display never shows 00:00 before the end. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
