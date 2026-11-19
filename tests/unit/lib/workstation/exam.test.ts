import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXAM_SPEC,
  applyAnswers,
  coveredLectures,
  markExam,
  parseRecords,
  pickQuestions,
  questionHistory,
  type CoverageTopic,
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

describe("coveredLectures", () => {
  const topics: CoverageTopic[] = [
    { subject: "ENG", lecture: "L1", doneDay: "2026-11-20" },
    { subject: "ENG", lecture: "L2", doneDay: "2026-11-21" },
    { subject: "ENG", lecture: "L3", doneDay: null },
    { subject: "BAN", lecture: "B1", doneDay: "2026-11-21" },
    { subject: "BAN", lecture: "B2", doneDay: "2026-11-10" },
  ];
  const week = Array.from({ length: 7 }, (_, i) => `2026-11-${String(21 + i).padStart(2, "0")}`);

  it("daily: lectures ticked done today", () => {
    const out = coveredLectures("DAILY", topics, { today: "2026-11-21", week });
    expect(out).toEqual([
      { subject: "ENG", lecture: "L2" },
      { subject: "BAN", lecture: "B1" },
    ]);
  });

  it("weekly: lectures ticked done this week", () => {
    const out = coveredLectures("WEEKLY", topics, {
      today: "2026-11-21",
      week: ["2026-11-20", ...week.slice(0, 6)],
    });
    expect(out.map((l) => l.lecture)).toEqual(["L1", "L2", "B1"]);
  });

  it("subject final: every lecture of the subject, done or not", () => {
    const out = coveredLectures("SUBJECT_FINAL", topics, {
      today: "2026-11-21",
      week,
      subject: "ENG",
    });
    expect(out.map((l) => l.lecture)).toEqual(["L1", "L2", "L3"]);
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
