import { describe, expect, it } from "vitest";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";
import { cyclesByWeekday, defaultRoutine } from "@/lib/workstation/routine";
import {
  LECTURE_CYCLES,
  HOLIDAY_LECTURE_CYCLES,
  buildSchedule,
  cycleLabels,
  subjectRoutine,
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
    learningDays: 80,
    revisionDays: 20,
    capacityByWeekday: CAPACITY,
    subjects: [subject("vocab", 3, { isDaily: true }), subject("eng", 4), subject("ban", 2)],
    today: "2026-11-21",
    doneToday: 0,
    dailyDoneToday: false,
    vocabDaysDone: 0,
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
    // 2 lectures (4 cycles), then the rest of the session revises ENG.
    expect(kinds(s, "2026-11-21")).toEqual(["daily:1", "topic:2", "topic:2", "revision:2"]);
    expect(first.items.slice(1, 3).map((i) => i.topicId)).toEqual(["eng-1", "eng-2"]);
    expect(first.items[3]).toMatchObject({
      kind: "revision",
      label: "Revise ENG",
      subjectId: "eng",
    });
    expect(first.items.reduce((n, i) => n + i.cycles, 0)).toBe(7);
  });

  it("gives a subject's revision and final exam a day of their own, with no lectures", () => {
    const s = buildSchedule(input());
    // Day 2 (Sunday): ENG's last 2 lectures, then revision; the final waits for Monday.
    expect(kinds(s, "2026-11-22")).toEqual(["daily:1", "topic:2", "topic:2", "revision:2"]);
    // Day 3 (Monday): ENG final day; nothing else, the rest of the day is free.
    expect(kinds(s, "2026-11-23")).toEqual(["daily:1", "subject-revision:2", "subject-final:1"]);
    // Day 4: the next subject starts.
    expect(s.days[3].items[1]).toMatchObject({ kind: "topic", topicId: "ban-1" });
    const eng = s.subjects.find((p) => p.subjectId === "eng");
    expect(eng).toMatchObject({ status: "current", projectedEnd: "2026-11-23", totalTopics: 4 });
    expect(s.subjects.find((p) => p.subjectId === "ban")?.status).toBe("upcoming");
  });

  it("reserves weekly revision and exam on Fridays", () => {
    const big = input({ subjects: [subject("eng", 60)] });
    const s = buildSchedule(big);
    // 2026-11-27 is the first Friday: 14 cycles = 3 lectures + weekly revision 3 + exam 1 + 4 revision.
    expect(kinds(s, "2026-11-27")).toEqual([
      "topic:2",
      "topic:2",
      "topic:2",
      "weekly-revision:3",
      "weekly-exam:1",
      "revision:4",
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
    // 3 done today (1 vocabulary + 2 lecture): 2 of 4 lecture cycles and 4 of 7 cycles left.
    expect(s.days[0].items.map((i) => `${i.topicId ?? i.kind}:${i.cycles}`)).toEqual([
      "eng-2:1",
      "eng-3:1",
      "revision:2",
    ]);
  });

  it("switches to rotating revision with a mock test every second day after the learning phase", () => {
    // ENG lecture, ENG final, BAN lecture, BAN final, then 4 revision days.
    const s = buildSchedule(
      input({ learningDays: 4, revisionDays: 4, subjects: [subject("eng", 1), subject("ban", 1)] }),
    );
    expect(s.days.map((d) => d.phase)).toEqual([
      ...Array(4).fill("learning"),
      ...Array(4).fill("revision"),
    ]);
    expect(s.learningEnd).toBe("2026-11-24");
    expect(s.planEnd).toBe("2026-11-28");
    expect(s.projectedLearningEnd).toBe("2026-11-24");
    expect(s.bufferDays).toBe(0);
    const day5 = s.days[4].items.map((i) => i.kind);
    const day6 = s.days[5].items.map((i) => i.kind);
    expect(day5).not.toContain("mock");
    expect(day6).toContain("mock");
    expect(s.days[4].items[0].kind).toBe("revision");
    expect(new Set(s.days.slice(4).flatMap((d) => d.items.map((i) => i.label)))).toEqual(
      new Set(["Revise ENG", "Revise BAN", "Mock test (full syllabus)"]),
    );
  });

  it("reports overflow when the learning work does not fit, and keeps laying it out", () => {
    const s = buildSchedule(
      input({ learningDays: 1, revisionDays: 1, subjects: [subject("eng", 10)] }),
    );
    // 23 cycles of work (20 lecture + 2 revision + 1 final) at 2 lectures a day:
    // Sat–Wed lectures, Thursday the final, 5 days past the 1-day phase.
    expect(s.remainingLearningCycles).toBe(23);
    expect(s.projectedLearningEnd).toBe("2026-11-26");
    expect(s.bufferDays).toBe(-5);
    expect(s.projectedLearningEnd! > s.learningEnd).toBe(true);
    expect(s.days.at(-1)?.phase).toBe("overflow");
  });

  it("falling behind a day pushes projections out", () => {
    // 19 topics = 38 lecture cycles: Sat–Thu 4 + Fri 6 = 30, Sat 4, Sun 4, Monday the final.
    const onTime = buildSchedule(input({ subjects: [subject("eng", 19)] }));
    const late = buildSchedule(input({ subjects: [subject("eng", 19)], today: "2026-11-22" }));
    expect(onTime.projectedLearningEnd).toBe("2026-11-30");
    expect(late.projectedLearningEnd).toBe("2026-12-01");
    expect(late.bufferDays).toBe(onTime.bufferDays - 1); // the missed Saturday
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

  it("learns 10 new words Saturday–Thursday and revises the week's words on Friday", () => {
    const s = buildSchedule(
      input({ subjects: [subject("vocab", 3, { isDaily: true }), subject("eng", 60)] }),
    );
    const daily = (day: string) =>
      s.days.find((d) => d.day === day)?.items.find((i) => i.kind === "daily");
    // Sat 21 … Thu 26 = six word days, Fri 27 = revision, Sat 28 continues the count.
    expect(daily("2026-11-21")).toMatchObject({ cycles: 1, topicId: "vocab-1" });
    expect(daily("2026-11-21")?.label).toContain("Words 1–10");
    expect(daily("2026-11-26")?.label).toContain("Words 51–60");
    expect(daily("2026-11-27")?.cycles).toBe(1);
    expect(daily("2026-11-27")?.topicId).toBeUndefined();
    expect(daily("2026-11-27")?.label).toBe("Vocabulary revision: this week's 60 words");
    expect(daily("2026-11-28")?.label).toContain("Words 61–70");
  });

  it("continues the word count from vocabulary days already done", () => {
    const s = buildSchedule(input({ vocabDaysDone: 4 }));
    expect(s.days[0].items[0].label).toContain("Words 41–50");
  });

  it("lays out the real BCS syllabus (164 videos) at 2 lectures a day (3 on Fridays), a little past 80 days", () => {
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
    // One lecture per video; at 2 a day (Fridays too) they run into the revision phase.
    expect(lectures).toBe(164);
    const s = buildSchedule(input({ subjects }));
    expect(s.bufferDays).toBeLessThan(0);
    expect(s.bufferDays).toBeGreaterThan(-20);
    const scheduled = s.days.flatMap((d) => d.items).filter((i) => i.kind === "topic");
    expect(new Set(scheduled.map((i) => i.topicId)).size).toBe(164);
    expect(s.days.filter((d) => d.phase !== "overflow")).toHaveLength(100);
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

describe("daily lecture limit", () => {
  const busy = () => input({ subjects: [subject("eng", 60)], learningDays: 30 });
  const lectureCycles = (s: ReturnType<typeof buildSchedule>, day: string) =>
    s.days
      .find((d) => d.day === day)!
      .items.filter((i) => i.kind === "topic")
      .reduce((n, i) => n + i.cycles, 0);

  it("caps lectures at 2 on office days and 3 on Friday", () => {
    const s = buildSchedule(busy());
    expect(lectureCycles(s, "2026-11-21")).toBe(LECTURE_CYCLES); // Saturday
    expect(lectureCycles(s, "2026-11-26")).toBe(LECTURE_CYCLES); // Thursday
    expect(lectureCycles(s, "2026-11-27")).toBe(HOLIDAY_LECTURE_CYCLES); // Friday
  });

  it("fills the rest of a lecture day's session with revision of the current subject", () => {
    const s = buildSchedule(busy());
    for (const d of s.days.filter((x) => x.phase === "learning").slice(0, 7)) {
      expect(d.items.reduce((n, i) => n + i.cycles, 0)).toBe(d.capacity);
      expect(d.items.filter((i) => i.kind === "revision").every((i) => i.subjectId === "eng")).toBe(
        true,
      );
    }
  });

  it("keeps the subject final day free of lectures and revision blocks", () => {
    const s = buildSchedule(input({ subjects: [subject("eng", 2), subject("ban", 4)] }));
    const final = s.days.find((d) => d.items.some((i) => i.kind === "subject-final"))!;
    expect(final.items.map((i) => i.kind)).toEqual(["subject-revision", "subject-final"]);
    expect(final.items.reduce((n, i) => n + i.cycles, 0)).toBeLessThan(final.capacity);
  });
});

describe("holidays", () => {
  it("studies a holiday like a Friday: 3 lectures, but no weekly exam", () => {
    const s = buildSchedule(
      input({
        subjects: [subject("eng", 60)],
        learningDays: 30,
        holidays: ["2026-11-25"], // a Wednesday
        holidayCapacityByWeekday: [14, 14, 14, 14, 14, 14, 14],
      }),
    );
    const day = s.days.find((d) => d.day === "2026-11-25")!;
    expect(day.capacity).toBe(14);
    expect(day.items.filter((i) => i.kind === "topic").reduce((n, i) => n + i.cycles, 0)).toBe(
      HOLIDAY_LECTURE_CYCLES,
    );
    expect(day.items.some((i) => i.kind.startsWith("weekly"))).toBe(false);
    expect(day.items.reduce((n, i) => n + i.cycles, 0)).toBe(14);
  });

  it("keeps a holiday that is a subject's final day free of lectures", () => {
    const s = buildSchedule(
      input({ subjects: [subject("eng", 2), subject("ban", 4)], holidays: ["2026-11-22"] }),
    );
    // ENG's 2 lectures fill Saturday; the Sunday holiday is ENG's final day.
    expect(kinds(s, "2026-11-22")).toEqual(["subject-revision:2", "subject-final:1"]);
  });
});

describe("revision plan", () => {
  it("gives whole revision days to subjects in order, then falls back to rotation", () => {
    // Learning: ENG lecture, ENG final, BAN lecture, BAN final (21–24 Nov).
    const s = buildSchedule(
      input({
        learningDays: 4,
        revisionDays: 4,
        subjects: [subject("eng", 1), subject("ban", 1)],
        revisionPlan: [
          { subjectIds: ["eng"], days: 2 },
          { subjectIds: ["eng", "ban"], days: 1 },
        ],
      }),
    );
    const revise = (day: string) =>
      s.days
        .find((d) => d.day === day)!
        .items.map((i) => `${i.kind}:${i.subjectId ?? "-"}:${i.cycles}`);
    expect(revise("2026-11-25")).toEqual(["revision:eng:7"]);
    expect(revise("2026-11-26")).toEqual(["revision:eng:7"]);
    // A Friday shared by two subjects: 14 cycles split evenly, no weekly exam, no mock.
    expect(revise("2026-11-27")).toEqual(["revision:eng:7", "revision:ban:7"]);
    // Past the plan: the old rotation with a mock test every second revision day.
    expect(kinds(s, "2026-11-28")).toContain("mock:3");
  });
});

describe("subjectRoutine", () => {
  it("lists only the days a subject is studied, with its lectures, revision and final", () => {
    const s = buildSchedule(input());
    const eng = subjectRoutine(s.days, "eng");
    // Day 1: eng-1, eng-2 then revision; day 2: eng-3, eng-4 then revision; day 3: the final.
    expect(eng[0]).toMatchObject({ day: "2026-11-21", index: 1, phase: "learning" });
    expect(eng[0].items.filter((i) => i.kind === "topic").map((i) => i.topicId)).toEqual([
      "eng-1",
      "eng-2",
    ]);
    expect(eng[1].items.map((i) => i.kind)).toEqual(["topic", "topic", "revision"]);
    expect(eng[2].items.map((i) => i.kind)).toEqual(["subject-revision", "subject-final"]);
    expect(eng.flatMap((d) => d.items).some((i) => i.kind === "daily")).toBe(false);
    expect(eng.flatMap((d) => d.items).every((i) => i.subjectId === "eng")).toBe(true);
  });

  it("includes the subject's revision-phase blocks", () => {
    const s = buildSchedule(input());
    const eng = subjectRoutine(s.days, "eng");
    expect(eng.some((d) => d.items.some((i) => i.kind === "revision"))).toBe(true);
  });

  it("is empty for an unknown subject", () => {
    expect(subjectRoutine(buildSchedule(input()).days, "nope")).toEqual([]);
  });
});
