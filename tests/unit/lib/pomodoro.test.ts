import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  InvalidTransitionError,
  MINUTE_MS,
  RUN_GAP_MS,
  cycleCountFrom,
  elapsedMs,
  endsAt,
  focusCreditMinutes,
  formatClock,
  isFinished,
  remainingMs,
  stateFromPersisted,
  transition,
  type ActiveSession,
  type PomodoroSettings,
  type TimerState,
} from "@/lib/pomodoro";

const T0 = Date.UTC(2026, 10, 15, 9, 0, 0);
const s: PomodoroSettings = {
  ...DEFAULT_SETTINGS,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 2,
};
const idle: TimerState = { status: "idle", next: "FOCUS", cycleCount: 0 };

function running(state: TimerState) {
  if (state.status !== "focus" && state.status !== "break" && state.status !== "paused") {
    throw new Error(`expected a session, got ${state.status}`);
  }
  return state.session;
}

describe("time math", () => {
  const session: ActiveSession = {
    id: "a",
    type: "FOCUS",
    plannedMinutes: 25,
    startedAt: T0,
    pausedAt: null,
    pausedMs: 0,
  };

  it("derives elapsed and remaining from timestamps", () => {
    expect(elapsedMs(session, T0 + 10 * MINUTE_MS)).toBe(10 * MINUTE_MS);
    expect(remainingMs(session, T0 + 10 * MINUTE_MS)).toBe(15 * MINUTE_MS);
    expect(endsAt(session)).toBe(T0 + 25 * MINUTE_MS);
  });

  it("clamps before start and after end", () => {
    expect(elapsedMs(session, T0 - 5000)).toBe(0);
    expect(remainingMs(session, T0 + 99 * MINUTE_MS)).toBe(0);
    expect(isFinished(session, T0 + 25 * MINUTE_MS - 1)).toBe(false);
    expect(isFinished(session, T0 + 25 * MINUTE_MS)).toBe(true);
  });

  it("freezes while paused and excludes pause time", () => {
    const paused = { ...session, pausedAt: T0 + 5 * MINUTE_MS, pausedMs: 2 * MINUTE_MS };
    expect(elapsedMs(paused, T0 + 60 * MINUTE_MS)).toBe(3 * MINUTE_MS);
    expect(endsAt(paused)).toBeNull();
    expect(isFinished(paused, T0 + 999 * MINUTE_MS)).toBe(false);
  });

  it("credits planned minutes on completion and whole elapsed minutes on skip", () => {
    expect(focusCreditMinutes(session, T0 + 25 * MINUTE_MS, true)).toBe(25);
    expect(focusCreditMinutes(session, T0 + 7.9 * MINUTE_MS, false)).toBe(7);
    expect(focusCreditMinutes({ ...session, type: "SHORT_BREAK" }, T0 + MINUTE_MS, true)).toBe(0);
  });

  it("formats a clock that never shows 00:00 early", () => {
    expect(formatClock(25 * MINUTE_MS)).toBe("25:00");
    expect(formatClock(59_001)).toBe("01:00");
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-5)).toBe("00:00");
  });
});

describe("state machine", () => {
  it("start → pause → resume → finish → done", () => {
    let st = transition(idle, { type: "START", id: "f1", now: T0 }, s);
    expect(st.status).toBe("focus");
    expect(running(st)).toMatchObject({ type: "FOCUS", plannedMinutes: 25, startedAt: T0 });

    st = transition(st, { type: "PAUSE", now: T0 + 10 * MINUTE_MS }, s);
    expect(st.status).toBe("paused");

    st = transition(st, { type: "RESUME", now: T0 + 13 * MINUTE_MS }, s);
    expect(st.status).toBe("focus");
    expect(running(st).pausedMs).toBe(3 * MINUTE_MS);
    expect(endsAt(running(st))).toBe(T0 + 28 * MINUTE_MS);

    // A tick before the end is a no-op.
    expect(transition(st, { type: "TICK", now: T0 + 27 * MINUTE_MS }, s)).toBe(st);

    st = transition(st, { type: "TICK", now: T0 + 28 * MINUTE_MS }, s);
    expect(st).toEqual({ status: "done", finished: "FOCUS", next: "SHORT_BREAK", cycleCount: 1 });
  });

  it("alternates focus and breaks, with a long break every N cycles", () => {
    let st: TimerState = idle;
    let now = T0;
    const phases: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      st = transition(st, { type: "START", id: `s${i}`, now }, s);
      const sess = running(st);
      phases.push(sess.type);
      now = endsAt(sess) as number;
      st = transition(st, { type: "TICK", now }, s);
    }
    expect(phases).toEqual(["FOCUS", "SHORT_BREAK", "FOCUS", "LONG_BREAK", "FOCUS", "SHORT_BREAK"]);
  });

  it("skip ends the phase without counting it and goes idle", () => {
    let st = transition(idle, { type: "START", id: "f1", now: T0 }, s);
    st = transition(st, { type: "SKIP", now: T0 + MINUTE_MS }, s);
    expect(st).toEqual({ status: "idle", next: "SHORT_BREAK", cycleCount: 0 });
    st = transition(st, { type: "START", id: "b1", now: T0 + 2 * MINUTE_MS }, s);
    st = transition(st, { type: "SKIP", now: T0 + 3 * MINUTE_MS }, s);
    expect(st).toEqual({ status: "idle", next: "FOCUS", cycleCount: 0 });
  });

  it("skipping a paused phase works", () => {
    let st = transition(idle, { type: "START", id: "f1", now: T0 }, s);
    st = transition(st, { type: "PAUSE", now: T0 + 1000 }, s);
    expect(transition(st, { type: "SKIP", now: T0 + 2000 }, s).status).toBe("idle");
  });

  it("auto-start begins the next phase at the previous end, not at tick time", () => {
    const auto = { ...s, autoStartNext: true };
    let st = transition(idle, { type: "START", id: "f1", now: T0 }, auto);
    // The tab was in the background; the tick arrives 3 minutes late.
    st = transition(st, { type: "TICK", now: T0 + 28 * MINUTE_MS, nextId: "b1" }, auto);
    expect(st.status).toBe("break");
    const brk = running(st);
    expect(brk).toMatchObject({ id: "b1", type: "SHORT_BREAK", startedAt: T0 + 25 * MINUTE_MS });
    expect(remainingMs(brk, T0 + 28 * MINUTE_MS)).toBe(2 * MINUTE_MS);
  });

  it("auto-start needs an id for the new session; without one it stops at done", () => {
    const auto = { ...s, autoStartNext: true };
    const st = transition(idle, { type: "START", id: "f1", now: T0 }, auto);
    expect(transition(st, { type: "TICK", now: T0 + 25 * MINUTE_MS }, auto).status).toBe("done");
  });

  it("rejects invalid transitions", () => {
    expect(() => transition(idle, { type: "PAUSE", now: T0 }, s)).toThrow(InvalidTransitionError);
    expect(() => transition(idle, { type: "RESUME", now: T0 }, s)).toThrow(InvalidTransitionError);
    expect(() => transition(idle, { type: "SKIP", now: T0 }, s)).toThrow(InvalidTransitionError);
    const st = transition(idle, { type: "START", id: "f1", now: T0 }, s);
    expect(() => transition(st, { type: "START", id: "f2", now: T0 }, s)).toThrow(
      "Cannot start while focus",
    );
    expect(() => transition(st, { type: "RESUME", now: T0 }, s)).toThrow(InvalidTransitionError);
    // Pausing a phase whose time is already up is not allowed; it must complete.
    expect(() => transition(st, { type: "PAUSE", now: T0 + 25 * MINUTE_MS }, s)).toThrow(
      InvalidTransitionError,
    );
    // Ticks never throw.
    expect(transition(idle, { type: "TICK", now: T0 }, s)).toBe(idle);
  });
});

describe("restoring persisted state", () => {
  it("restores a running or paused session (e.g. after reload)", () => {
    const active: ActiveSession = {
      id: "a",
      type: "FOCUS",
      plannedMinutes: 25,
      startedAt: T0,
      pausedAt: null,
      pausedMs: 0,
    };
    const st = stateFromPersisted({
      active,
      last: null,
      cycleCount: 1,
      settings: s,
      now: T0 + 60_000,
    });
    expect(st.status).toBe("focus");
    const paused = stateFromPersisted({
      active: { ...active, pausedAt: T0 + 1000 },
      last: null,
      cycleCount: 0,
      settings: s,
      now: T0,
    });
    expect(paused.status).toBe("paused");
  });

  it("shows done right after a completed phase, idle after a skip, and resets after a long gap", () => {
    const last = {
      type: "FOCUS" as const,
      completed: true,
      startedAt: T0,
      endedAt: T0 + 25 * MINUTE_MS,
    };
    expect(
      stateFromPersisted({
        active: null,
        last,
        cycleCount: 1,
        settings: s,
        now: last.endedAt + 1000,
      }),
    ).toEqual({
      status: "done",
      finished: "FOCUS",
      next: "SHORT_BREAK",
      cycleCount: 1,
    });
    expect(
      stateFromPersisted({
        active: null,
        last: { ...last, completed: false },
        cycleCount: 0,
        settings: s,
        now: last.endedAt,
      }),
    ).toEqual({ status: "idle", next: "SHORT_BREAK", cycleCount: 0 });
    expect(
      stateFromPersisted({
        active: null,
        last,
        cycleCount: 1,
        settings: s,
        now: last.endedAt + RUN_GAP_MS + 1,
      }),
    ).toMatchObject({ status: "idle", next: "FOCUS" });
  });
});

describe("cycleCountFrom", () => {
  const at = (min: number) => T0 + min * MINUTE_MS;
  it("counts completed focus sessions back to the last long break", () => {
    expect(
      cycleCountFrom([
        { type: "SHORT_BREAK", completed: true, startedAt: at(85), endedAt: at(90) },
        { type: "FOCUS", completed: true, startedAt: at(60), endedAt: at(85) },
        { type: "FOCUS", completed: false, startedAt: at(55), endedAt: at(58) },
        { type: "LONG_BREAK", completed: true, startedAt: at(40), endedAt: at(55) },
        { type: "FOCUS", completed: true, startedAt: at(15), endedAt: at(40) },
      ]),
    ).toBe(1);
  });

  it("stops at a gap longer than a run", () => {
    expect(
      cycleCountFrom([
        { type: "FOCUS", completed: true, startedAt: at(200), endedAt: at(225) },
        { type: "FOCUS", completed: true, startedAt: at(0), endedAt: at(25) },
      ]),
    ).toBe(1);
  });
});

describe("with fake timers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it("stays exact when interval callbacks are throttled (background tab)", () => {
    const st = transition(idle, { type: "START", id: "f1", now: Date.now() }, s);
    const session = running(st);
    const readings: number[] = [];
    // A background tab may only run timers once a minute; readings are still exact.
    const id = setInterval(() => readings.push(remainingMs(session, Date.now())), MINUTE_MS);
    vi.advanceTimersByTime(3 * MINUTE_MS);
    clearInterval(id);
    expect(readings).toEqual([24, 23, 22].map((m) => m * MINUTE_MS));
  });

  it("survives a 'reload': rebuilding from persisted data yields the same remaining time", () => {
    const st = transition(idle, { type: "START", id: "f1", now: Date.now() }, s);
    vi.advanceTimersByTime(7 * MINUTE_MS + 30_000);
    const restored = stateFromPersisted({
      active: running(st),
      last: null,
      cycleCount: 0,
      settings: s,
      now: Date.now(),
    });
    expect(formatClock(remainingMs(running(restored), Date.now()))).toBe("17:30");
  });

  it("completes on the first tick after the end even if the tick is late", () => {
    let st = transition(idle, { type: "START", id: "f1", now: Date.now() }, s);
    vi.advanceTimersByTime(40 * MINUTE_MS);
    st = transition(st, { type: "TICK", now: Date.now() }, s);
    expect(st).toMatchObject({ status: "done", finished: "FOCUS" });
  });
});
