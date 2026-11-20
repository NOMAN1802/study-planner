import { describe, expect, it } from "vitest";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";
import {
  LECTURE_BOOK_SLICES,
  lectureBookPath,
  lectureSlug,
  slicePages,
} from "@/lib/workstation/lecture-books";

/** Pages in the English Grammar & Literature lecture book. */
const ENGLISH_BOOK_PAGES = 276;

describe("lecture books", () => {
  const english = BCS_SYLLABUS.find((s) => s.name === "English Literature + Grammar")!;

  it("covers every English lecture", () => {
    const missing = english.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]);
    expect(missing.map((t) => t.title)).toEqual([]);
  });

  it("only names lectures that exist", () => {
    const titles = new Set(BCS_SYLLABUS.flatMap((s) => s.topics.map((t) => t.title)));
    expect(Object.keys(LECTURE_BOOK_SLICES).filter((t) => !titles.has(t))).toEqual([]);
  });

  it("uses page ranges inside the book", () => {
    for (const [title, slice] of Object.entries(LECTURE_BOOK_SLICES)) {
      const pages = slicePages(slice.pages);
      expect(pages.length, title).toBeGreaterThan(0);
      expect(Math.min(...pages), title).toBeGreaterThanOrEqual(1);
      expect(Math.max(...pages), title).toBeLessThanOrEqual(ENGLISH_BOOK_PAGES);
    }
  });

  it("gives each lecture its own file", () => {
    const paths = Object.keys(LECTURE_BOOK_SLICES).map(lectureBookPath);
    expect(new Set(paths).size).toBe(paths.length);
    expect(lectureBookPath("Grammar 8: Tense")).toBe("english/grammar-8-tense.pdf");
    expect(lectureBookPath("No such lecture")).toBeNull();
  });

  it("expands page ranges", () => {
    expect(slicePages("3-5,9")).toEqual([3, 4, 5, 9]);
    expect(lectureSlug("Lit 10: Post Modern Period (1939 – Present)")).toBe(
      "lit-10-post-modern-period-1939-present",
    );
  });
});
