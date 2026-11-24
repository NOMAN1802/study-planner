import { describe, expect, it } from "vitest";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";
import {
  LECTURE_BOOK_SLICES,
  lectureBookPath,
  lectureSlug,
  slicePages,
} from "@/lib/workstation/lecture-books";

describe("lecture books", () => {
  const english = BCS_SYLLABUS.find((s) => s.name === "English Literature + Grammar")!;

  it("covers every English lecture", () => {
    const missing = english.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]);
    expect(missing.map((t) => t.title)).toEqual([]);
  });

  it("covers every Bangla lecture except the question-solving sessions", () => {
    const bangla = BCS_SYLLABUS.find((s) => s.name === "Bangla Literature + Grammar")!;
    const missing = bangla.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]).map((t) => t.title);
    expect(missing).toHaveLength(3);
    expect(missing.every((t) => t.includes("প্রশ্ন সলভ সেশন"))).toBe(true);
  });

  it("covers every Math + Mental Ability lecture", () => {
    const math = BCS_SYLLABUS.find((s) => s.name === "Math + Mental Ability")!;
    expect(math.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]).map((t) => t.title)).toEqual(
      [],
    );
  });

  it("covers every International Affairs lecture", () => {
    const ia = BCS_SYLLABUS.find((s) => s.name === "International Affairs")!;
    expect(ia.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]).map((t) => t.title)).toEqual([]);
    expect(lectureBookPath("০৬: এশিয়া-০১")).toBe("international/antorjatik-06.pdf");
  });

  it("covers every Bangladesh Affairs lecture", () => {
    const ba = BCS_SYLLABUS.find((s) => s.name === "Bangladesh Affairs")!;
    expect(ba.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]).map((t) => t.title)).toEqual([]);
    expect(lectureBookPath("০৩: মোগল আমল")).toBe("bangladesh/bangladesh-03.pdf");
  });

  it("covers every General Science lecture", () => {
    const gs = BCS_SYLLABUS.find((s) => s.name === "General Science")!;
    expect(gs.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]).map((t) => t.title)).toEqual([]);
    expect(lectureBookPath("০৬: তাপ ও শব্দ")).toBe("science/biggan-06.pdf");
  });

  it("covers every Computer & ICT lecture", () => {
    const ict = BCS_SYLLABUS.find((s) => s.name === "Computer & ICT")!;
    expect(ict.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]).map((t) => t.title)).toEqual([]);
    expect(lectureBookPath("04: Logic Gate")).toBe("ict/ict-04.pdf");
  });

  it("covers every Geography and Morality lecture", () => {
    for (const name of ["Geography", "Morality, Values & Good Governance"]) {
      const subject = BCS_SYLLABUS.find((s) => s.name === name)!;
      expect(
        subject.topics.filter((t) => !LECTURE_BOOK_SLICES[t.title]).map((t) => t.title),
      ).toEqual([]);
    }
    expect(lectureBookPath("০৬: আবহাওয়া ও জলবায়ু")).toBe("geo-moral/bhugol-06.pdf");
    expect(lectureBookPath("০২: নৈতিকতা, সুশাসন ও মূল্যবোধ-২")).toBe("geo-moral/noitikota-02.pdf");
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
      expect(Math.max(...pages), title).toBeLessThanOrEqual(slice.book.pages);
    }
  });

  it("gives each lecture its own file", () => {
    const paths = Object.keys(LECTURE_BOOK_SLICES).map(lectureBookPath);
    expect(new Set(paths).size).toBe(paths.length);
    expect(lectureBookPath("Grammar 8: Tense")).toBe("english/grammar-8-tense.pdf");
    expect(lectureBookPath("ব্যাকরণ ০৫: সন্ধি")).toBe("bangla/byakoron-05.pdf");
    expect(lectureBookPath("No such lecture")).toBeNull();
  });

  it("expands page ranges", () => {
    expect(slicePages("3-5,9")).toEqual([3, 4, 5, 9]);
    expect(lectureSlug("Lit 10: Post Modern Period (1939 – Present)")).toBe(
      "lit-10-post-modern-period-1939-present",
    );
  });
});
