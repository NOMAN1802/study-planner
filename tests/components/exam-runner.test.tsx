import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamRunner, type RunnerQuestion } from "@/components/workstation/exam-runner";

const submitExam = vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({}));
vi.mock("@/actions/exam", () => ({
  submitExam: (...args: unknown[]) => submitExam(...args),
}));

const questions: RunnerQuestion[] = [
  { id: "q1", text: "First?", options: ["a1", "b1", "c1", "d1"], section: "S" },
  { id: "q2", text: "Second?", options: ["a2", "b2", "c2", "d2"], section: "S" },
];

const START = new Date("2026-11-20T15:00:00Z");

function renderRunner(minutes = 15) {
  return render(
    <ExamRunner
      examId="11111111-1111-4111-8111-111111111111"
      title="Daily exam"
      deadline={new Date(START.getTime() + minutes * 60_000).toISOString()}
      serverNow={START.toISOString()}
      questions={questions}
    />,
  );
}

describe("ExamRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout"] });
    vi.setSystemTime(START);
    window.localStorage.clear();
    submitExam.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down and tracks answers, keeping them across a reload", () => {
    const { unmount } = renderRunner();
    expect(screen.getByTestId("exam-timer")).toHaveTextContent("15:00");
    fireEvent.click(screen.getByLabelText(/c1/));
    expect(screen.getByTestId("exam-progress")).toHaveTextContent("1/2 answered");
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByTestId("exam-timer")).toHaveTextContent("13:59");

    unmount();
    renderRunner();
    expect(screen.getByLabelText(/c1/)).toBeChecked();
  });

  it("asks before submitting with questions left blank", async () => {
    renderRunner();
    fireEvent.click(screen.getByLabelText(/a1/));
    fireEvent.click(screen.getAllByRole("button", { name: "Submit answers" })[0]);
    expect(screen.getByText("1 left blank. Submit?")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });
    expect(submitExam).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", { q1: 0 });
  });

  it("submits automatically when time is up", async () => {
    renderRunner(1);
    fireEvent.click(screen.getByLabelText(/b2/));
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(submitExam).toHaveBeenCalledTimes(1);
    expect(submitExam).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", { q2: 1 });
  });
});
