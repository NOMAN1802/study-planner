import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskForm } from "@/components/tasks/task-form";
import type { TaskFormState } from "@/schemas/task";

type Action = (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
const mockAction = (impl: Action = async () => ({})) => vi.fn<Action>(impl);
const habits = [
  { id: "3f6c2d0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f", name: "Deep work" },
  { id: "4a7d3e1f-2c3b-4d4e-9f0a-1b2c3d4e5f6a", name: "Reading" },
];

describe("TaskForm", () => {
  it("defaults to To do / Medium with no habit", () => {
    render(
      <TaskForm
        action={mockAction()}
        habits={habits}
        timezone="Asia/Dhaka"
        submitLabel="Create task"
      />,
    );
    expect(screen.getByLabelText("Status")).toHaveValue("TODO");
    expect(screen.getByRole("radio", { name: "Medium" })).toBeChecked();
    expect(screen.getByLabelText("Linked habit")).toHaveValue("");
    expect(screen.getByText(/Asia\/Dhaka|Asia Dhaka/)).toBeInTheDocument();
  });

  it("validates on the client and does not submit invalid input", async () => {
    const user = userEvent.setup();
    const action = mockAction();
    render(<TaskForm action={action} habits={habits} timezone="UTC" submitLabel="Create task" />);

    await user.type(screen.getByLabelText("Target minutes"), "0");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Target minutes must be at least 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects an over-long title", async () => {
    const user = userEvent.setup();
    const action = mockAction();
    render(<TaskForm action={action} habits={habits} timezone="UTC" submitLabel="Create task" />);
    const title = screen.getByLabelText("Title");
    // maxLength stops typing past 120; bypass it to exercise the schema.
    title.removeAttribute("maxLength");
    await user.type(title, "x".repeat(121));
    await user.click(screen.getByRole("button", { name: "Create task" }));
    expect(await screen.findByText("Title must be at most 120 characters")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("submits all fields", async () => {
    const user = userEvent.setup();
    const action = mockAction();
    render(<TaskForm action={action} habits={habits} timezone="UTC" submitLabel="Create task" />);

    await user.type(screen.getByLabelText("Title"), "Write report");
    await user.click(screen.getByRole("radio", { name: "Urgent" }));
    await user.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
    await user.type(screen.getByLabelText("Due"), "2030-01-15T09:30");
    await user.type(screen.getByLabelText("Target minutes"), "90");
    await user.selectOptions(screen.getByLabelText("Linked habit"), "Reading");
    await user.type(screen.getByLabelText("Note"), "Include Q4 numbers");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(Object.fromEntries(data.entries())).toEqual({
      category: "GENERAL",
      title: "Write report",
      priority: "URGENT",
      status: "IN_PROGRESS",
      dueAt: "2030-01-15T09:30",
      targetMinutes: "90",
      habitId: habits[1].id,
      note: "Include Q4 numbers",
    });
  });

  it("disables habit linking when there are no habits", () => {
    render(<TaskForm action={mockAction()} habits={[]} timezone="UTC" submitLabel="Create task" />);
    expect(screen.getByLabelText("Linked habit")).toBeDisabled();
    expect(screen.getByText("No active habits yet.")).toBeInTheDocument();
  });

  it("pre-fills values when editing and shows server errors", async () => {
    const user = userEvent.setup();
    const action = mockAction(async () => ({ error: "Task not found." }));
    render(
      <TaskForm
        action={action}
        habits={habits}
        timezone="UTC"
        submitLabel="Save changes"
        defaults={{
          title: "Existing",
          note: "n",
          status: "DONE",
          priority: "HIGH",
          dueLocal: "2030-01-15T09:30",
          targetMinutes: 30,
          habitId: habits[0].id,
        }}
      />,
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Existing");
    expect(screen.getByLabelText("Status")).toHaveValue("DONE");
    expect(screen.getByRole("radio", { name: "High" })).toBeChecked();
    expect(screen.getByLabelText("Due")).toHaveValue("2030-01-15T09:30");
    expect(screen.getByLabelText("Linked habit")).toHaveValue(habits[0].id);

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Task not found.");
  });
});

import { TaskFilters } from "@/components/tasks/task-filters";
import { DEFAULT_FILTERS } from "@/schemas/task";

vi.mock("next/form", () => ({
  default: ({ children, ...props }: React.ComponentProps<"form">) => (
    <form {...props}>{children}</form>
  ),
}));

describe("TaskFilters", () => {
  it("gives each filter a concise accessible name", () => {
    render(<TaskFilters filters={DEFAULT_FILTERS} />);
    for (const name of ["Status", "Priority", "Due", "Sort"]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("offers a reset link when filters differ from the defaults", () => {
    render(<TaskFilters filters={{ ...DEFAULT_FILTERS, priority: "HIGH" }} />);
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute("href", "/tasks");
  });
});
