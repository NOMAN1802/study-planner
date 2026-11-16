import { describe, expect, it } from "vitest";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";
import { cyclesByWeekday, defaultRoutine } from "@/lib/workstation/routine";
import {
  buildSchedule,
  cycleLabels,
  type PlanSubject,
  type ScheduleInput,
} from "@/lib/workstation/schedule";

const CAPACITY = cyclesByWeekday(defaultRoutine()); // 7 a day, 14 on Friday

function subject(id: string, topics: number, extra: Partial<PlanSubject> = {}): PlanSubject {
  return {
    id,
    name: id.toUpperCase(),
    color: "#000",
    isDaily: false,
    finalDone: false,
    topics: Array.from({ length: topics }, (_, i) => ({
      id: `${id}-${i + 1}`,
      title: `${id} ${i + 1}`,
      estCycles: 2,
      done: false,
      spentCycles: 0,
    })),
    ...extra,
  };
}

// 2026-11-21 is a Saturday.
function input(over: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    startDay: "2026-11-21",
    learningDays: 70,
    revisionDays: 20,
    capacityByWeekday: CAPACITY,
    subjects: [subject("vocab", 3, { isDaily: true }), subject("eng", 4), subject("ban", 2)],
    today: "2026-11-21",
    doneToday: 0,
    dailyDoneToday: false,
    weeklyExamDays: [],
    mockDays: [],
    ...over,
  };
}

const kinds = (s: ReturnType<typeof buildSchedule>, day: string) =>
  s.days.find((d) => d.day === day)?.items.map((i) => `${i.kind}:${i.cycles}`) ?? [];

describe("buildSchedule", () => {
  it("starts each day with one vocabulary cycle, then subjects in order", () => {
    const s = buildSchedule(input());
    const first = s.days[0];
    expect(first.capacity).toBe(7);
    expect(first.items[0]).toMatchObject({ kind: "daily", cycles: 1, topicId: "vocab-1" });
    expect(first.items.slice(1).map((i) => i.topicId)).toEqual(["eng-1", "eng-2", "eng-3"]);
    // 6 cycles of topics on day 1: eng-1..eng-3 at 2 cycles each.
    expect(first.items.reduce((n, i) => n + i.cycles, 0)).toBe(7);
  });

  it("adds a subject revision and final exam after its last topic, before the next subject", () => {
    const s = buildSchedule(input());
    // Day 2 (Sunday): vocab, eng-4 (2), ENG revision (2), ENG final (1), ban-1 (1 of 2)
    expect(kinds(s, "2026-11-22")).toEqual([
      "daily:1",
      "topic:2",
      "subject-revision:2",
      "subject-final:1",
      "topic:1",
    ]);
    const eng = s.subjects.find((p) => p.subjectId === "eng");
    expect(eng).toMatchObject({ status: "current", projectedEnd: "2026-11-22", totalTopics: 4 });
    expect(s.subjects.find((p) => p.subjectId === "ban")?.status).toBe("upcoming");
  });

  it("reserves weekly revision and exam on Fridays", () => {
    const big = input({ subjects: [subject("eng", 60)] });
    const s = buildSchedule(big);
    // 2026-11-27 is the first Friday: 14 cycles = 10 learning + 3 revision + 1 exam.
    expect(kinds(s, "2026-11-27")).toEqual([
      "topic:2",
      "topic:2",
      "topic:2",
      "topic:2",
      "topic:2",
      "weekly-revision:3",
      "weekly-exam:1",
    ]);
  });

  it("skips the weekly exam once it is recorded for that Friday", () => {
    const s = buildSchedule(
      input({ subjects: [subject("eng", 60)], weeklyExamDays: ["2026-11-27"] }),
    );
    expect(kinds(s, "2026-11-27").some((k) => k.startsWith("weekly"))).toBe(false);
  });

  it("removes cycles already done today and topics already done", () => {
    const base = input({ subjects: [subject("vocab", 1, { isDaily: true }), subject("eng", 10)] });
    base.subjects[1].topics[0].done = true;
    base.subjects[1].topics[1].spentCycles = 1;
    const s = buildSchedule({ ...base, doneToday: 3, dailyDoneToday: true });
    // 7 - 3 = 4 cycles left: eng-2 has 1 left, eng-3 2, eng-4 1 (of 2).
    expect(s.days[0].items.map((i) => `${i.topicId}:${i.cycles}`)).toEqual([
      "eng-2:1",
      "eng-3:2",
      "eng-4:1",
    ]);
  });

  it("switches to rotating revision with a mock test every second day after the learning phase", () => {
    const s = buildSchedule(
      input({ learningDays: 2, revisionDays: 4, subjects: [subject("eng", 1), subject("ban", 1)] }),
    );
    expect(s.days.map((d) => d.phase)).toEqual([
      "learning",
      "learning",
      "revision",
      "revision",
      "revision",
      "revision",
    ]);
    expect(s.learningEnd).toBe("2026-11-22");
    expect(s.planEnd).toBe("2026-11-26");
    const day3 = s.days[2].items.map((i) => i.kind);
    const day4 = s.days[3].items.map((i) => i.kind);
    expect(day3).not.toContain("mock");
    expect(day4).toContain("mock");
    expect(s.days[2].items[0].kind).toBe("revision");
    expect(new Set(s.days.slice(2).flatMap((d) => d.items.map((i) => i.label)))).toEqual(
      new Set(["Revise ENG", "Revise BAN", "Mock test (full syllabus)"]),
    );
  });

  it("reports overflow when the learning work does not fit, and keeps laying it out", () => {
    const s = buildSchedule(
      input({ learningDays: 1, revisionDays: 1, subjects: [subject("eng", 10)] }),
    );
    // 23 cycles of work (20 topics + 2 revision + 1 final), 7 available on day 1.
    expect(s.remainingLearningCycles).toBe(23);
    expect(s.learningCapacityLeft).toBe(7);
    expect(s.bufferCycles).toBe(-16);
    expect(s.projectedLearningEnd! > s.learningEnd).toBe(true);
    expect(s.days.at(-1)?.phase).toBe("overflow");
  });

  it("falling behind a day pushes projections out", () => {
    // 19 topics = 41 cycles: ends Thursday on time, Friday a day late.
    const onTime = buildSchedule(input({ subjects: [subject("eng", 19)] }));
    const late = buildSchedule(input({ subjects: [subject("eng", 19)], today: "2026-11-22" }));
    expect(onTime.projectedLearningEnd).toBe("2026-11-26");
    expect(late.projectedLearningEnd).toBe("2026-11-27");
    expect(late.projectedLearningEnd! > onTime.projectedLearningEnd!).toBe(true);
    expect(late.bufferCycles).toBe(onTime.bufferCycles - 7); // the missed Saturday
  });

  it("starts the layout on the start day when today is earlier", () => {
    const s = buildSchedule(input({ today: "2026-11-17" }));
    expect(s.days[0]).toMatchObject({ day: "2026-11-21", index: 1 });
  });

  it("marks a subject done once all topics and its final are done", () => {
    const eng = subject("eng", 1, { finalDone: true });
    eng.topics[0].done = true;
    const s = buildSchedule(input({ subjects: [eng, subject("ban", 1)] }));
    expect(s.subjects.map((p) => p.status)).toEqual(["done", "current"]);
  });

  it("fits the real BCS syllabus in 70 days with the default routine", () => {
    const subjects: PlanSubject[] = BCS_SYLLABUS.map((sub, i) => ({
      id: `s${i}`,
      name: sub.name,
      color: sub.color,
      isDaily: Boolean(sub.isDaily),
      finalDone: false,
      topics: sub.topics.map((t, j) => ({
        id: `s${i}-${j}`,
        title: t.title,
        estCycles: 2,
        done: false,
        spentCycles: 0,
      })),
    }));
    const lectures = subjects.filter((x) => !x.isDaily).reduce((n, x) => n + x.topics.length, 0);
    expect(lectures).toBe(164);
    const s = buildSchedule(input({ subjects }));
    expect(s.bufferCycles).toBeGreaterThan(0);
    expect(s.projectedLearningEnd! <= s.learningEnd).toBe(true);
    expect(s.days.filter((d) => d.phase !== "overflow")).toHaveLength(90);
  });
});

describe("cycleLabels", () => {
  it("expands items into one entry per cycle", () => {
    expect(
      cycleLabels([
        { kind: "daily", cycles: 1, label: "v" },
        { kind: "topic", cycles: 2, label: "t" },
      ]).map((i) => i.label),
    ).toEqual(["v", "t", "t"]);
  });
});
