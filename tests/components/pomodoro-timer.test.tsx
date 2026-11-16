import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PomodoroTimer } from "@/components/pomodoro/pomodoro-timer";
import { DEFAULT_SETTINGS, MINUTE_MS, type ActiveSession } from "@/lib/pomodoro";
import type { TimerSnapshot } from "@/lib/pomodoro-server";

const runTimer = vi.fn();
vi.mock("@/actions/pomodoro", () => ({ runTimer: (...args: unknown[]) => runTimer(...args) }));

const playChime = vi.fn();
vi.mock("@/lib/alerts", async (orig) => ({
  ...(await orig<typeof import("@/lib/alerts")>()),
  playChime: () => playChime(),
}));

const T0 = Date.UTC(2026, 10, 15, 9, 0, 0);
const TASK = "3f6c2d0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f";

function snap(over: Partial<TimerSnapshot> = {}): TimerSnapshot {
  return {
    taskId: TASK,
    settings: DEFAULT_SETTINGS,
    active: null,
    last: null,
    cycleCount: 0,
    serverNow: Date.now(),
    otherActive: null,
    ...over,
  };
}
const focus = (over: Partial<ActiveSession> = {}): ActiveSession => ({
  id: "s1",
  type: "FOCUS",
  plannedMinutes: 25,
  startedAt: Date.now(),
  pausedAt: null,
  pausedMs: 0,
  ...over,
});

const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const remaining = () => screen.getByTestId("timer-remaining").textContent;
/**
 * Click and let the (mocked) server action and React transition settle.
 * Testing Library's async utilities don't drive Vitest's fake clock, so flush it explicitly.
 */
const click = (el: HTMLElement) =>
  act(async () => {
    fireEvent.click(el);
    await vi.advanceTimersByTimeAsync(0);
  });

describe("PomodoroTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"],
    });
    vi.setSystemTime(T0);
    runTimer.mockReset();
    playChime.mockReset();
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("starts a focus session and counts down from timestamps", async () => {
    runTimer.mockImplementation(async () => ({ snapshot: snap({ active: focus() }) }));
    render(<PomodoroTimer taskTitle="Write" initial={snap()} />);

    expect(screen.getByTestId("timer-phase")).toHaveTextContent("Ready for focus");
    expect(remaining()).toBe("25:00");

    await click(screen.getByRole("button", { name: "Start focus" }));
    expect(runTimer).toHaveBeenCalledWith(TASK, "START", null);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();

    await advance(61_000);
    expect(remaining()).toBe("23:59");
  });

  it("restores a running session mid-way (as after a reload)", () => {
    render(
      <PomodoroTimer
        taskTitle="Write"
        initial={snap({ active: focus({ startedAt: T0 - 10 * MINUTE_MS - 30_000 }) })}
      />,
    );
    expect(remaining()).toBe("14:30");
    expect(screen.getByTestId("timer-phase")).toHaveTextContent("Focus");
  });

  it("freezes while paused and resumes", async () => {
    const started = focus({ startedAt: T0 - 5 * MINUTE_MS });
    render(<PomodoroTimer taskTitle="Write" initial={snap({ active: started })} />);
    expect(remaining()).toBe("20:00");

    runTimer.mockImplementationOnce(async () => ({
      snapshot: snap({ active: { ...started, pausedAt: Date.now() } }),
    }));
    await click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByTestId("timer-phase")).toHaveTextContent("Focus · paused");

    await advance(3 * MINUTE_MS);
    expect(remaining()).toBe("20:00");

    runTimer.mockImplementationOnce(async () => ({
      snapshot: snap({ active: { ...started, pausedMs: 3 * MINUTE_MS } }),
    }));
    await click(screen.getByRole("button", { name: "Resume" }));
    expect(runTimer).toHaveBeenLastCalledWith(TASK, "RESUME", null);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await advance(60_000);
    expect(remaining()).toBe("19:00");
  });

  it("completes at the end time, then offers the break, and chimes if enabled", async () => {
    window.localStorage.setItem("pomodoro:alerts", JSON.stringify({ sound: true, notify: false }));
    const active = focus({ startedAt: T0 - 25 * MINUTE_MS + 2000 });
    runTimer.mockImplementation(async () => ({
      snapshot: snap({
        last: { type: "FOCUS", completed: true, startedAt: active.startedAt, endedAt: T0 + 2000 },
        cycleCount: 1,
        serverNow: Date.now(),
      }),
    }));
    render(<PomodoroTimer taskTitle="Write" initial={snap({ active })} />);
    expect(remaining()).toBe("00:02");
    expect(runTimer).not.toHaveBeenCalled();

    await advance(2100);
    expect(runTimer).toHaveBeenCalledWith(TASK, "COMPLETE", null);
    expect(screen.getByText("Focus complete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start short break" })).toBeInTheDocument();
    expect(playChime).toHaveBeenCalledTimes(1);
  });

  it("skips to idle", async () => {
    runTimer.mockImplementation(async () => ({
      snapshot: snap({
        last: { type: "FOCUS", completed: false, startedAt: T0, endedAt: T0 + 1000 },
      }),
    }));
    render(<PomodoroTimer taskTitle="Write" initial={snap({ active: focus() })} />);
    await click(screen.getByRole("button", { name: "Skip" }));
    expect(runTimer).toHaveBeenCalledWith(TASK, "SKIP", null);
    expect(screen.getByRole("button", { name: "Start short break" })).toBeInTheDocument();
    expect(screen.getByTestId("timer-phase")).toHaveTextContent("Ready for short break");
  });

  it("blocks starting while another task's timer runs, and shows server errors", async () => {
    render(
      <PomodoroTimer
        taskTitle="Write"
        initial={snap({ otherActive: { taskId: "x", title: "Other task" } })}
      />,
    );
    expect(screen.getByRole("link", { name: "Other task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start focus" })).toBeDisabled();
  });

  it("toggles the sound preference", async () => {
    render(<PomodoroTimer taskTitle="Write" initial={snap()} />);
    const sound = screen.getByRole("button", { name: "Sound off" });
    expect(sound).toHaveAttribute("aria-pressed", "false");
    await click(sound);
    expect(screen.getByRole("button", { name: "Sound on" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(JSON.parse(window.localStorage.getItem("pomodoro:alerts") as string)).toEqual({
      sound: true,
      notify: false,
    });
  });
});
