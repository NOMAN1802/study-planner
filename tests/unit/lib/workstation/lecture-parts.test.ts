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
  it("keeps every original video exactly once", () => {
    const urls = BCS_SYLLABUS.flatMap((s) => s.topics.flatMap((t) => t.parts.map((p) => p.url)));
    expect(urls).toHaveLength(172); // 164 lecture videos + 8 vocabulary
    expect(new Set(urls).size).toBe(172);
  });

  it("merges multi-part lectures following the routine", () => {
    const english = BCS_SYLLABUS.find((s) => s.name === "English Literature + Grammar")!;
    const anatomy = english.topics.find((t) => t.title.startsWith("Grammar 01"))!;
    expect(anatomy.parts.map((p) => p.title)).toEqual([
      "Grammar 1.1: Basic & Gerund Participle (Part-1)",
      "Grammar 1.2: Basic & Gerund Participle (Part-2)",
    ]);
    const vocab = BCS_SYLLABUS.find((s) => s.isDaily)!;
    expect(vocab.topics.map((t) => t.title)).toEqual([
      "Vocabulary Marathon-1",
      "Vocabulary Marathon-2",
    ]);
  });
});
