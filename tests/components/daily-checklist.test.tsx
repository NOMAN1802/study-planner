import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DailyChecklist } from "@/components/daily-habits/daily-checklist";
import { PRAYERS } from "@/lib/daily-habits";
import type { DailyChecklist as Data, DailyHabit } from "@/lib/daily-habits-server";

const setDailyCheck = vi.fn<(input: unknown) => Promise<{ error?: string }>>(async () => ({}));
vi.mock("@/actions/daily-habits", () => ({
  setDailyCheck: (input: unknown) => setDailyCheck(input),
  saveDayNote: vi.fn(async () => ({})),
  saveHabitDayNote: vi.fn(async () => ({})),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const habit = (id: string, over: Partial<DailyHabit> = {}): DailyHabit => ({
  id,
  name: id,
  icon: "circle",
  color: "#0f766e",
  preset: null,
  parts: [],
  firstDay: "2026-11-01",
  archivedDay: null,
  archived: false,
  ...over,
});

const PRAYER_ID = "00000000-0000-4000-8000-000000000001";
const QURAN_ID = "00000000-0000-4000-8000-000000000002";

function data(over: Partial<Data> = {}): Data {
  return {
    day: "2026-11-22",
    today: "2026-11-22",
    habits: [
      habit(PRAYER_ID, { name: "Prayer", preset: "prayer", parts: [...PRAYERS] }),
      habit(QURAN_ID, { name: "Read Quran 10 min", preset: "quran" }),
      habit("study", { name: "Study at least 7 hours", preset: "study", auto: "study" }),
    ],
    cells: { [PRAYER_ID]: { value: 0.4, parts: [0, 1], note: null } },
    studyHours: 3,
    note: "",
    hasSet: true,
    ...over,
  };
}

describe("DailyChecklist", () => {
  it("shows the five prayers, the day's progress and study hours from the Study Station", () => {
    render(<DailyChecklist data={data()} />);
    for (const p of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      expect(screen.getByRole("checkbox", { name: p })).toBeInTheDocument();
    }
    expect(screen.getByRole("checkbox", { name: "Fajr" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Asr" })).not.toBeChecked();
    // Prayer 2/5 = 0.4 of 3 habits → 13%; nothing fully done.
    expect(screen.getByTestId("daily-done")).toHaveTextContent("0 / 3");
    expect(screen.getByTestId("daily-score")).toHaveTextContent("13%");
    expect(screen.getByTestId("study-hours")).toHaveTextContent("3 / 7 h");
    // The study habit is not a checkbox: it can't be ticked by hand.
    expect(screen.queryByRole("checkbox", { name: /study/i })).toBeNull();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("ticks a prayer and a habit, updating progress at once", async () => {
    const user = userEvent.setup();
    render(<DailyChecklist data={data()} />);
    await user.click(screen.getByRole("checkbox", { name: "Asr" }));
    expect(setDailyCheck).toHaveBeenCalledWith({
      habitId: PRAYER_ID,
      done: true,
      part: 2,
      day: "2026-11-22",
    });
    await user.click(screen.getByRole("checkbox", { name: "Read Quran 10 min" }));
    expect(setDailyCheck).toHaveBeenLastCalledWith({
      habitId: QURAN_ID,
      done: true,
      day: "2026-11-22",
    });
  });

  it("calls a day with every habit done a perfect day", () => {
    render(
      <DailyChecklist
        data={data({
          cells: {
            [PRAYER_ID]: { value: 1, parts: [0, 1, 2, 3, 4], note: null },
            [QURAN_ID]: { value: 1, parts: [], note: null },
          },
          studyHours: 8,
        })}
      />,
    );
    expect(screen.getByTestId("daily-done")).toHaveTextContent("3 / 3");
    expect(screen.getByRole("status")).toHaveTextContent("Perfect day");
  });

  it("offers going back to today from a past day, but not ahead into the future", () => {
    render(<DailyChecklist data={data({ day: "2026-11-20" })} />);
    expect(screen.getByTestId("daily-date")).toHaveTextContent("20 Nov 2026");
    expect(screen.getByRole("link", { name: "Next day" })).toHaveAttribute(
      "href",
      "/habits/daily?date=2026-11-21",
    );
    const list = screen.getByRole("list", { name: "Daily habits" });
    expect(within(list).getAllByTestId("daily-habit")).toHaveLength(3);
  });
});
