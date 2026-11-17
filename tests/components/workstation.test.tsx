import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoutineTab } from "@/components/workstation/routine-tab";
import { SetupForm } from "@/components/workstation/setup-form";
import { defaultRoutine } from "@/lib/workstation/routine";
import type { WsSlot } from "@/lib/workstation/server";

vi.mock("@/actions/workstation", () => ({
  setupPlan: vi.fn(async () => ({})),
  saveSlot: vi.fn(async () => ({})),
  deleteSlot: vi.fn(async () => ({})),
  resetRoutine: vi.fn(async () => ({})),
}));

const slots: WsSlot[] = defaultRoutine().map((s, i) => ({ ...s, id: `slot-${i}` }));

describe("RoutineTab", () => {
  it("shows 56 cycles a week with 7 on office days and 14 on Friday", () => {
    render(<RoutineTab slots={slots} />);
    expect(screen.getByTestId("ws-routine-total")).toHaveTextContent("56");
    expect(screen.getByText("(target 56)")).toBeInTheDocument();
    const days = screen.getAllByTestId("ws-routine-day");
    expect(days.map((d) => within(d).getByRole("heading").textContent)).toEqual([
      "Saturday",
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]);
    expect(within(days[0]).getByText("7 cycles")).toBeInTheDocument();
    expect(within(days[6]).getByText("14 cycles")).toBeInTheDocument();
    // The office slot: its label and its type.
    expect(within(days[0]).getAllByText("Office")).toHaveLength(2);
  });

  it("warns when the week no longer adds up to 56", () => {
    render(
      <RoutineTab slots={slots.filter((s) => !(s.weekday === 5 && s.label === "Evening study"))} />,
    );
    expect(screen.getByTestId("ws-routine-total")).toHaveTextContent("52");
    expect(screen.getByText("· target is 56")).toBeInTheDocument();
  });

  it("opens an add-slot form for a day", () => {
    render(<RoutineTab slots={slots} />);
    fireEvent.click(screen.getByRole("button", { name: "Add slot on Friday" }));
    const form = screen.getByRole("form", { name: "New slot on Friday" });
    expect(within(form).getByLabelText("Start")).toHaveValue("19:00");
    expect(within(form).getByLabelText("Type")).toHaveValue("STUDY");
  });
});

describe("SetupForm", () => {
  it("defaults to an 80 + 20 day plan from the given start", () => {
    render(<SetupForm defaultStart="2026-11-17" />);
    expect(screen.getByLabelText("First study day")).toHaveValue("2026-11-17");
    expect(screen.getByLabelText("Learning days")).toHaveValue(80);
    expect(screen.getByLabelText("Revision days")).toHaveValue(20);
    expect(screen.getByRole("button", { name: "Create study plan" })).toBeEnabled();
  });
});
