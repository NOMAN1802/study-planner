import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LectureLinks } from "@/components/workstation/lecture-links";

const parts = [{ title: "Grammar 8: Tense", url: "https://youtu.be/x" }];

describe("LectureLinks", () => {
  it("links the lecture book pages when the lecture has them", () => {
    render(<LectureLinks parts={parts} topicId="t-1" book="Tense" />);
    expect(screen.getByRole("link", { name: /Lecture/ })).toHaveAttribute("href", parts[0].url);
    const book = screen.getByRole("link", { name: /Book \(PDF\)/ });
    expect(book).toHaveAttribute("href", "/work-station/book/t-1");
    expect(book).toHaveAttribute("target", "_blank");
  });

  it("shows no book link without book pages", () => {
    render(<LectureLinks parts={parts} topicId="t-1" book={null} />);
    expect(screen.queryByRole("link", { name: /Book/ })).toBeNull();
  });
});
