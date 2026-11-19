import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXAM_SPEC,
  applyAnswers,
  examStats,
  markExam,
  parseRecords,
  pickQuestions,
  questionHistory,
  type QuestionInfo,
} from "@/lib/workstation/exam";
import { bankFileSchema, expandBank } from "@/lib/workstation/question-bank";

const answers = new Map([
  ["q1", 0],
  ["q2", 1],
  ["q3", 2],
  ["q4", 3],
]);
const answerOf = (id: string) => answers.get(id);

describe("exam sizes", () => {
  it("follows the BCS Preliminary standard", () => {
    expect(EXAM_SPEC).toEqual({
      DAILY: { questions: 20, minutes: 15 },
      WEEKLY: { questions: 50, minutes: 30 },
      SUBJECT_FINAL: { questions: 100, minutes: 60 },
    });
  });
});

describe("markExam", () => {
  it("gives +1 for correct, −0.5 for wrong and 0 for unanswered", () => {
    const m = markExam(
      [
        { id: "q1", chosen: 0 },
        { id: "q2", chosen: 1 },
        { id: "q3", chosen: 0 },
        { id: "q4", chosen: null },
      ],
      answerOf,
    );
    expect(m).toEqual({ score: 1.5, correct: 2, wrong: 1, unanswered: 1, total: 4 });
  });

  it("allows a negative total", () => {
    const m = markExam(
      [
        { id: "q1", chosen: 1 },
        { id: "q2", chosen: 0 },
      ],
      answerOf,
    );
    expect(m.score).toBe(-1);
  });
});

describe("answer sheets", () => {
  it("parses stored records and rejects anything else", () => {
    expect(
      parseRecords([
        { id: "q1", chosen: 2 },
        { id: "q2", chosen: 9 },
      ]),
    ).toEqual([
      { id: "q1", chosen: 2 },
      { id: "q2", chosen: null },
    ]);
    expect(parseRecords(null)).toBeNull();
    expect(parseRecords([{ chosen: 1 }])).toBeNull();
  });

  it("only applies answers to the exam's own questions, in its order", () => {
    const records = [
      { id: "q2", chosen: null },
      { id: "q1", chosen: null },
    ];
    expect(applyAnswers(records, { q1: 0, q2: 7, other: 1 })).toEqual([
      { id: "q2", chosen: null },
      { id: "q1", chosen: 0 },
    ]);
  });
});

describe("pickQuestions", () => {
  const pool = ["q1", "q2", "q3", "q4", "q5", "q6"];
  const history = questionHistory(
    [
      // Older exam: q1 wrong, q2 right.
      {
        submittedAt: new Date("2026-11-20T10:00:00Z"),
        records: [
          { id: "q1", chosen: 3 },
          { id: "q2", chosen: 1 },
        ],
      },
      // Newer exam: q1 now right, q3 left blank (counts as missed).
      {
        submittedAt: new Date("2026-11-21T10:00:00Z"),
        records: [
          { id: "q1", chosen: 0 },
          { id: "q3", chosen: null },
        ],
      },
      // Not submitted: ignored.
      { submittedAt: null, records: [{ id: "q4", chosen: 0 }] },
    ],
    answerOf,
  );

  it("keeps the latest result per question", () => {
    expect(history.get("q1")).toEqual({ lastCorrect: true });
    expect(history.get("q2")).toEqual({ lastCorrect: true });
    expect(history.get("q3")).toEqual({ lastCorrect: false });
    expect(history.has("q4")).toBe(false);
  });

  it("asks unseen questions first, then missed ones, then the rest", () => {
    const picked = pickQuestions(pool, history, 6, () => 0);
    expect(new Set(picked.slice(0, 3))).toEqual(new Set(["q4", "q5", "q6"]));
    expect(picked[3]).toBe("q3");
    expect(new Set(picked.slice(4))).toEqual(new Set(["q1", "q2"]));
  });

  it("asks at most the exam size and never repeats a question", () => {
    expect(pickQuestions([...pool, "q1"], history, 4)).toHaveLength(4);
    expect(new Set(pickQuestions(pool, new Map(), 20))).toEqual(new Set(pool));
  });
});

describe("examStats", () => {
  const info = new Map<string, QuestionInfo>([
    ["t1", { answer: 0, section: "Literary Terms", lecture: "Lit 01" }],
    ["t2", { answer: 0, section: "Literary Terms", lecture: "Lit 01" }],
    ["t3", { answer: 0, section: "Literary Terms", lecture: "Lit 01" }],
    ["r1", { answer: 1, section: "Renaissance", lecture: "Lit 02" }],
    ["r2", { answer: 1, section: "Renaissance", lecture: "Lit 02" }],
    ["r3", { answer: 1, section: "Renaissance", lecture: "Lit 02" }],
    ["s1", { answer: 2, section: "Spenser", lecture: "Lit 03" }],
  ]);
  const at = new Date("2026-11-20T00:00:00Z");
  const stats = examStats(
    [
      {
        id: "e1",
        kind: "DAILY",
        day: "2026-11-20",
        at,
        score: 2.5,
        total: 4,
        records: [
          { id: "t1", chosen: 0 },
          { id: "t2", chosen: 0 },
          { id: "t3", chosen: 0 },
          { id: "r1", chosen: 0 },
        ],
      },
      {
        id: "e2",
        kind: "DAILY",
        day: "2026-11-21",
        at,
        score: -1,
        total: 3,
        records: [
          { id: "r2", chosen: 0 },
          { id: "r3", chosen: 0 },
          { id: "s1", chosen: null },
        ],
      },
      // Recorded by hand: counts for scores, has no questions for topics.
      { id: "e3", kind: "WEEKLY", day: "2026-11-27", at, score: 40, total: 50, records: null },
      // No score (nothing to average).
      { id: "e4", kind: "MOCK", day: "2026-11-28", at, score: null, total: null, records: null },
    ],
    info,
  );

  it("averages percentages, counting negative scores as 0%", () => {
    expect(stats.count).toBe(3);
    // 63% (2.5/4), 0% (−1/3), 80% (40/50) → 48%.
    expect(stats.averagePct).toBe(48);
    expect(stats.byKind).toEqual([
      { kind: "DAILY", count: 2, averagePct: 32 },
      { kind: "WEEKLY", count: 1, averagePct: 80 },
    ]);
  });

  it("lists recent results newest first and the trend oldest first", () => {
    expect(stats.recent.map((r) => r.id)).toEqual(["e3", "e2", "e1"]);
    expect(stats.trend.map((t) => t.pct)).toEqual([63, 0, 80]);
  });

  it("finds weak topics from answered questions (at least 3 asked)", () => {
    expect(stats.weakTopics).toEqual([
      { topic: "Renaissance", lecture: "Lit 02", correct: 0, asked: 3, pct: 0 },
      { topic: "Literary Terms", lecture: "Lit 01", correct: 3, asked: 3, pct: 100 },
    ]);
  });
});

describe("question-bank files", () => {
  it("expands sections into rows with stable ids and checks lectures", () => {
    const { rows, problems } = expandBank({
      subject: "English Literature + Grammar",
      sections: [
        {
          id: "lit-terms",
          title: "Literary Terms",
          lecture: "Lit 01: Literary Terms",
          questions: [{ q: "Q?", o: ["a", "b", "c", "d"], a: 2, s: "37th BCS" }],
        },
        {
          id: "lit-x",
          title: "X",
          lecture: "No such lecture",
          questions: [{ q: "Q2?", o: ["a", "b", "c", "d"], a: 0 }],
        },
      ],
    });
    expect(rows[0]).toMatchObject({
      id: "lit-terms-001",
      lecture: "Lit 01: Literary Terms",
      answer: 2,
      source: "37th BCS",
      explanation: null,
    });
    expect(problems).toEqual([
      'Section "X": no lecture "No such lecture" in English Literature + Grammar',
    ]);
  });

  it("rejects questions without exactly four options or with a bad answer", () => {
    const bad = {
      subject: "S",
      sections: [{ id: "s", title: "S", lecture: "L", questions: [{ q: "Q", o: ["a"], a: 5 }] }],
    };
    expect(bankFileSchema.safeParse(bad).success).toBe(false);
  });

  // The transcribed bank is kept out of git; check it whenever it is present.
  const path = "Doc/question-bank/english-literature.json";
  it.runIf(existsSync(path))("the English Literature bank is valid (194 questions)", () => {
    const file = bankFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    const { rows, problems } = expandBank(file);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(194);
    expect(new Set(rows.map((r) => r.id)).size).toBe(194);
  });
});
