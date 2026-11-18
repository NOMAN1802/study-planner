import { describe, expect, it } from "vitest";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";
import { lectureParts } from "@/lib/workstation/lecture-parts";

describe("lectureParts", () => {
  it("reads stored parts", () => {
    const parts = [
      { title: "Grammar 1.1", url: "https://youtu.be/a" },
      { title: "Grammar 1.2", url: "https://youtu.be/b" },
    ];
    expect(lectureParts(parts, "https://youtu.be/a")).toEqual(parts);
  });

  it("falls back to the single url of older rows", () => {
    expect(lectureParts([], "https://youtu.be/x")).toEqual([
      { title: "Lecture", url: "https://youtu.be/x" },
    ]);
    expect(lectureParts(null, null)).toEqual([]);
  });

  it("drops malformed or non-https parts", () => {
    expect(
      lectureParts(
        [
          { title: "ok", url: "https://youtu.be/ok" },
          { title: "bad", url: "javascript:alert(1)" },
          5,
        ],
        null,
      ),
    ).toEqual([{ title: "ok", url: "https://youtu.be/ok" }]);
  });
});

describe("merged syllabus", () => {
  it("has one lecture per video, each video exactly once", () => {
    const lectures = BCS_SYLLABUS.filter((s) => !s.isDaily).flatMap((s) => s.topics);
    expect(lectures).toHaveLength(164);
    expect(lectures.every((t) => t.parts.length === 1)).toBe(true);
    const urls = BCS_SYLLABUS.flatMap((s) => s.topics.flatMap((t) => t.parts.map((p) => p.url)));
    expect(urls).toHaveLength(172); // 164 lecture videos + 8 vocabulary
    expect(new Set(urls).size).toBe(172);
  });

  it("orders videos by the routine's classes and keeps vocabulary merged", () => {
    const english = BCS_SYLLABUS.find((s) => s.name === "English Literature + Grammar")!;
    const titles = english.topics.map((t) => t.title);
    // Grammar 1.1 and 1.2 are separate lectures, one after the other.
    const anatomy = titles.indexOf("Grammar 1.1: Basic & Gerund Participle (Part-1)");
    expect(titles[anatomy + 1]).toBe("Grammar 1.2: Basic & Gerund Participle (Part-2)");
    // The routine teaches Tense (video 8) before Preposition-1 (video 6).
    expect(titles.indexOf("Grammar 8: Tense")).toBeLessThan(
      titles.indexOf("Grammar 6: Preposition-1"),
    );
    const vocab = BCS_SYLLABUS.find((s) => s.isDaily)!;
    expect(vocab.topics.map((t) => t.title)).toEqual([
      "Vocabulary Marathon-1",
      "Vocabulary Marathon-2",
    ]);
  });
});
