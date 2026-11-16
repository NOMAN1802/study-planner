import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HabitForm } from "@/components/habits/habit-form";
import type { HabitFormState } from "@/schemas/habit";

type Action = (prev: HabitFormState, formData: FormData) => Promise<HabitFormState>;
const mockAction = (impl: Action = async () => ({})) => vi.fn<Action>(impl);

describe("HabitForm", () => {
  it("defaults to a daily habit and hides active hours", () => {
    render(<HabitForm action={mockAction()} submitLabel="Create habit" />);
    expect(screen.getByRole("radio", { name: "Daily" })).toBeChecked();
    expect(screen.queryByRole("group", { name: "Active hours" })).not.toBeInTheDocument();
  });

  it("shows active hours only when Hourly is selected", async () => {
    const user = userEvent.setup();
    render(<HabitForm action={mockAction()} submitLabel="Create habit" />);
    await user.click(screen.getByRole("radio", { name: "Hourly" }));
    expect(screen.getByRole("group", { name: "Active hours" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(24);
    await user.click(screen.getByRole("radio", { name: "Weekly" }));
    expect(screen.queryByRole("group", { name: "Active hours" })).not.toBeInTheDocument();
  });

  it("validates on the client and does not submit invalid input", async () => {
    const user = userEvent.setup();
    const action = mockAction();
    render(<HabitForm action={action} submitLabel="Create habit" />);

    await user.type(screen.getByLabelText("Target count per period"), "0");
    await user.type(screen.getByLabelText("Target minutes per period"), "2000");
    await user.click(screen.getByRole("button", { name: "Create habit" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Target count must be at least 1")).toBeInTheDocument();
    expect(screen.getByText("Target minutes can't exceed 1440 per day")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(action).not.toHaveBeenCalled();
  });

  it("submits the chosen values", async () => {
    const user = userEvent.setup();
    const action = mockAction();
    render(<HabitForm action={action} submitLabel="Create habit" />);

    await user.type(screen.getByLabelText("Name"), "Stretch");
    await user.click(screen.getByRole("radio", { name: "Hourly" }));
    await user.click(screen.getByRole("checkbox", { name: "09:00" }));
    await user.click(screen.getByRole("checkbox", { name: "10:00" }));
    await user.type(screen.getByLabelText("Target minutes per period"), "5");
    await user.click(screen.getByRole("radio", { name: "Red" }));
    await user.click(screen.getByRole("radio", { name: "dumbbell" }));
    await user.click(screen.getByRole("button", { name: "Create habit" }));

    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.get("name")).toBe("Stretch");
    expect(data.get("frequency")).toBe("HOURLY");
    expect(data.getAll("activeHours")).toEqual(["9", "10"]);
    expect(data.get("targetMinutes")).toBe("5");
    expect(data.get("color")).toBe("#b42318");
    expect(data.get("icon")).toBe("dumbbell");
  });

  it("pre-fills values when editing", () => {
    render(
      <HabitForm
        action={mockAction()}
        submitLabel="Save changes"
        defaults={{
          name: "Water",
          note: "8 glasses",
          color: "#475569",
          icon: "droplet",
          frequency: "HOURLY",
          targetCount: 1,
          targetMinutes: null,
          activeHours: [8, 12],
        }}
      />,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Water");
    expect(screen.getByLabelText("Note")).toHaveValue("8 glasses");
    expect(screen.getByRole("radio", { name: "Slate" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "08:00" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "09:00" })).not.toBeChecked();
  });

  it("shows server-side field errors", async () => {
    const user = userEvent.setup();
    const action = mockAction(async () => ({
      fieldErrors: { frequency: "Frequency can't change after check-ins exist." },
    }));
    render(<HabitForm action={action} submitLabel="Save" />);
    await user.type(screen.getByLabelText("Name"), "Read");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Frequency can't change after check-ins exist."),
    ).toBeInTheDocument();
  });
});
