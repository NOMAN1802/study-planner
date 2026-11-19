import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PracticeRunner, type PracticeQuestion } from "@/components/workstation/practice-runner";

const questions: PracticeQuestion[] = [
  {
    id: "p1",
    text: "First?",
    options: ["Right one", "w1", "w2", "w3"],
    answer: 0,
    explanation: "Because.",
    source: "37th BCS",
    section: "S",
  },
  {
    id: "p2",
    text: "Second?",
    options: ["x1", "x2", "Answer two", "x4"],
    answer: 2,
    explanation: null,
    source: null,
    section: "S",
  },
];

describe("PracticeRunner", () => {
  it("checks each answer as soon as it is chosen and locks the question", () => {
    render(<PracticeRunner questions={questions} again="/work-station/practice?n=10" />);
    const [first, second] = screen.getAllByTestId("practice-question");

    fireEvent.click(within(first).getByRole("button", { name: /Right one/ }));
    expect(within(first).getByTestId("practice-feedback")).toHaveTextContent(
      "Correct. [37th BCS] Because.",
    );
    // Locked once answered.
    expect(within(first).getByRole("button", { name: /w1/ })).toBeDisabled();

    fireEvent.click(within(second).getByRole("button", { name: /x1/ }));
    expect(within(second).getByTestId("practice-feedback")).toHaveTextContent(
      "Wrong — the answer is C.",
    );
    expect(screen.getByTestId("practice-tally")).toHaveTextContent("1 correct · 1 wrong · 0 left");
  });

  it("sums up at the end without saving anything", () => {
    render(<PracticeRunner questions={questions} again="/work-station/practice?n=10" />);
    const [first, second] = screen.getAllByTestId("practice-question");
    fireEvent.click(within(first).getByRole("button", { name: /w2/ }));
    fireEvent.click(within(second).getByRole("button", { name: /Answer two/ }));
    const summary = screen.getByTestId("practice-summary");
    expect(summary).toHaveTextContent("1/2 correct · would score 0.5 in a real exam. Not saved.");
    expect(
      within(summary).getByRole("link", { name: "New questions, same topics" }),
    ).toHaveAttribute("href", "/work-station/practice?n=10");
  });
});
