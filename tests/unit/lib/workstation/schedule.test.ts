import { describe, expect, it } from "vitest";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";
import {
  LECTURES_PER_DAY,
  HOLIDAY_LECTURES,
  buildSchedule,
  cycleLabels,
  subjectRoutine,
  topicFinishDays,
  type PlanSubject,
  type ScheduleInput,
} from "@/lib/workstation/schedule";

/** Fixed so these tests do not follow routine changes: 8 a day, 16 on Friday. */
const CAPACITY = [8, 8, 8, 8, 8, 16, 8];

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
    expect(first.capacity).toBe(8);
    expect(first.items[0]).toMatchObject({ kind: "daily", cycles: 1, topicId: "vocab-1" });
    // 2 lectures (4 cycles), then the rest of the session revises ENG.
    expect(kinds(s, "2026-11-21")).toEqual(["daily:1", "topic:2", "topic:2", "revision:3"]);
    expect(first.items.slice(1, 3).map((i) => i.topicId)).toEqual(["eng-1", "eng-2"]);
    expect(first.items[3]).toMatchObject({
      kind: "revision",
      label: "Revise ENG",
      subjectId: "eng",
    });
    expect(first.items.reduce((n, i) => n + i.cycles, 0)).toBe(8);
  });

  it("gives a subject's revision and final exam a day of their own, with no lectures", () => {
    const s = buildSchedule(input());
    // Day 2 (Sunday): ENG's last 2 lectures, then revision; the final waits for Monday.
    expect(kinds(s, "2026-11-22")).toEqual(["daily:1", "topic:2", "topic:2", "revision:3"]);
    // Day 3 (Monday): ENG final day; no vocabulary either, the rest of the day is free.
    expect(kinds(s, "2026-11-23")).toEqual(["subject-revision:2", "subject-final:1"]);
    // Day 4: the next subject starts.
    expect(s.days[3].items[1]).toMatchObject({ kind: "topic", topicId: "ban-1" });
    const eng = s.subjects.find((p) => p.subjectId === "eng");
    expect(eng).toMatchObject({ status: "current", projectedEnd: "2026-11-23", totalTopics: 4 });
    expect(s.subjects.find((p) => p.subjectId === "ban")?.status).toBe("upcoming");
  });

  it("reserves weekly revision and exam on Fridays", () => {
    const big = input({ subjects: [subject("eng", 60)] });
    const s = buildSchedule(big);
    // 2026-11-27 is the first Friday: 16 cycles = 2 lectures + weekly revision 3 + exam 1 + 8 revision.
    expect(kinds(s, "2026-11-27")).toEqual([
      "topic:2",
      "topic:2",
      "weekly-revision:3",
      "weekly-exam:1",
      "revision:8",
    ]);
  });

  it("skips the weekly exam once it is recorded for that Friday", () => {
    const s = buildSchedule(
      input({ subjects: [subject("eng", 60)], weeklyExamDays: ["2026-11-27"] }),
    );
    expect(kinds(s, "2026-11-27").some((k) => k.startsWith("weekly"))).toBe(false);
  });

  it("counts lectures ticked done today against today's two lectures", () => {
    // Lecture 1 was ticked today without the timer: only one more lecture today.
    const base = input({ subjects: [subject("eng", 10)] });
    base.subjects[0].topics[0].done = true;
    const s = buildSchedule({ ...base, lecturesDoneToday: 1 });
    expect(s.days[0].items.filter((i) => i.kind === "topic").map((i) => i.topicId)).toEqual([
      "eng-2",
    ]);
    // Tomorrow is back to two.
    expect(s.days[1].items.filter((i) => i.kind === "topic")).toHaveLength(2);
    // Timed cycles on the same lecture do not count it twice.
    const timed = buildSchedule({ ...base, doneToday: 2, lecturesDoneToday: 1 });
    expect(timed.days[0].items.filter((i) => i.kind === "topic")).toHaveLength(1);
  });

  it("removes cycles already done today and topics already done", () => {
    const base = input({ subjects: [subject("vocab", 1, { isDaily: true }), subject("eng", 10)] });
    base.subjects[1].topics[0].done = true;
    base.subjects[1].topics[1].spentCycles = 1;
    const s = buildSchedule({ ...base, doneToday: 3, dailyDoneToday: true, lecturesDoneToday: 1 });
    // 3 done today (1 vocabulary + lecture 1): one more lecture (eng-2, 1 cycle left), 5 of 8 cycles left.
    expect(s.days[0].items.map((i) => `${i.topicId ?? i.kind}:${i.cycles}`)).toEqual([
      "eng-2:1",
      "revision:4",
    ]);
  });

  it("switches to rotating revision with a mock test every second day after the learning phase", () => {
    // Day 1: ENG lecture + BAN lecture (the spare slot); day 2 ENG final; day 3 BAN final;
    // day 4 is a spare learning day; then 4 revision days.
    const s = buildSchedule(
      input({ learningDays: 4, revisionDays: 4, subjects: [subject("eng", 1), subject("ban", 1)] }),
    );
    expect(s.days.map((d) => d.phase)).toEqual([
      ...Array(4).fill("learning"),
      ...Array(4).fill("revision"),
    ]);
    expect(s.learningEnd).toBe("2026-11-24");
    expect(s.planEnd).toBe("2026-11-28");
    expect(s.projectedLearningEnd).toBe("2026-11-23");
    expect(s.bufferDays).toBe(1);
    expect(kinds(s, "2026-11-21").filter((k) => k.startsWith("topic"))).toHaveLength(2);
    expect(s.days[1].items.filter((i) => i.kind === "subject-final")).toHaveLength(1);
    expect(s.days[2].items.filter((i) => i.kind === "subject-final")).toHaveLength(1);
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
    // 19 topics at 2 a day, Fridays too: 21–30 Nov cover 19, Tuesday 1 Dec the final.
    const onTime = buildSchedule(input({ subjects: [subject("eng", 19)] }));
    const late = buildSchedule(input({ subjects: [subject("eng", 19)], today: "2026-11-22" }));
    expect(onTime.projectedLearningEnd).toBe("2026-12-01");
    expect(late.projectedLearningEnd).toBe("2026-12-02");
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

  it("moves to the next vocabulary lecture every 8 word days", () => {
    const s = buildSchedule(
      input({ subjects: [subject("vocab", 9, { isDaily: true }), subject("eng", 60)] }),
    );
    const topics = s.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "daily" && i.topicId)
      .map((i) => i.topicId);
    // Word days 1–8 → lecture 1, 9–16 → lecture 2, …; Fridays (revision) have none.
    expect(topics.slice(0, 8)).toEqual(Array(8).fill("vocab-1"));
    expect(topics[8]).toBe("vocab-2");
    expect(topics[16]).toBe("vocab-3");
    expect(topics[64]).toBe("vocab-9");
    expect(topics.at(-1)).toBe("vocab-9"); // the last lecture keeps any extra days
    // Already 12 word days done: today's words come from lecture 2.
    const later = buildSchedule(
      input({
        subjects: [subject("vocab", 9, { isDaily: true }), subject("eng", 60)],
        vocabDaysDone: 12,
      }),
    );
    expect(later.days[0].items[0]).toMatchObject({ kind: "daily", topicId: "vocab-2" });
  });

  it("has no vocabulary on a subject's final day", () => {
    const s = buildSchedule(
      input({ subjects: [subject("vocab", 9, { isDaily: true }), subject("eng", 2)] }),
    );
    // Sat 21: ENG's 2 lectures; Sun 22: ENG final, with no words that day.
    expect(kinds(s, "2026-11-22")).toEqual(["subject-revision:2", "subject-final:1"]);
    expect(s.days[2].items.find((i) => i.kind === "daily")?.label).toContain("Words 11–20");
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

  it("finishes the BCS lectures by 21 Feb on the 24 Nov plan (exam-ready 10 Mar)", () => {
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
    const s = buildSchedule(
      input({
        subjects,
        startDay: "2026-11-24",
        today: "2026-11-24",
        learningDays: 92,
        revisionDays: 15,
        holidays: ["2026-12-16", "2026-12-25", "2027-01-24", "2027-02-21"],
      }),
    );
    const finals = s.days
      .filter((d) => d.items.some((i) => i.kind === "subject-final"))
      .map((d) => d.day);
    expect(finals).toEqual([
      "2026-12-09",
      "2026-12-26",
      "2027-01-13",
      "2027-01-22",
      "2027-01-31",
      "2027-02-08",
      "2027-02-13",
      "2027-02-18",
      "2027-02-21",
    ]);
    expect(s.projectedLearningEnd).toBe("2027-02-21");
    expect(s.planEnd).toBe("2027-03-10");
    expect(s.bufferDays).toBe(2);
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

  const lectures = (s: ReturnType<typeof buildSchedule>, day: string) =>
    s.days.find((d) => d.day === day)!.items.filter((i) => i.kind === "topic").length;

  it("caps lectures at 2 a day, Fridays included, and 3 on a holiday", () => {
    const s = buildSchedule(busy());
    expect(lectures(s, "2026-11-21")).toBe(LECTURES_PER_DAY); // Saturday
    expect(lectures(s, "2026-11-26")).toBe(LECTURES_PER_DAY); // Thursday
    expect(lectures(s, "2026-11-27")).toBe(LECTURES_PER_DAY); // Friday
    expect(lectureCycles(s, "2026-11-21")).toBe(4);
    const friHoliday = buildSchedule({ ...busy(), holidays: ["2026-11-27"] });
    expect(lectures(friHoliday, "2026-11-27")).toBe(HOLIDAY_LECTURES); // a Friday holiday
  });

  it("starts the next subject in a spare slot, but keeps its final on a day of its own", () => {
    // ENG has 3 lectures: Sat 2, Sun 1 + BAN's first; Mon ENG final; Tue BAN's last 2.
    const s = buildSchedule(input({ subjects: [subject("eng", 3), subject("ban", 3)] }));
    const topics = (day: string) =>
      s.days
        .find((d) => d.day === day)!
        .items.filter((i) => i.kind === "topic")
        .map((i) => i.topicId);
    expect(topics("2026-11-22")).toEqual(["eng-3", "ban-1"]);
    expect(kinds(s, "2026-11-23")).toEqual(["subject-revision:2", "subject-final:1"]);
    expect(topics("2026-11-24")).toEqual(["ban-2", "ban-3"]);
  });

  it("counts lectures, not cycles: short lectures do not let a third one in on an office day", () => {
    // Lit 01 has 2 cycles left, Lit 02 and Lit 03 only 1 each (studied earlier).
    const base = busy();
    base.subjects[0].topics[1].spentCycles = 1;
    base.subjects[0].topics[2].spentCycles = 1;
    const s = buildSchedule(base);
    expect(
      s.days[0].items.filter((i) => i.kind === "topic").map((i) => `${i.topicId}:${i.cycles}`),
    ).toEqual(["eng-1:2", "eng-2:1"]);
    expect(kinds(s, "2026-11-21")).toEqual(["topic:2", "topic:1", "revision:5"]);
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
    expect(day.items.filter((i) => i.kind === "topic")).toHaveLength(HOLIDAY_LECTURES);
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
    expect(revise("2026-11-25")).toEqual(["revision:eng:8"]);
    expect(revise("2026-11-26")).toEqual(["revision:eng:8"]);
    // A Friday shared by two subjects: 16 cycles split evenly, no weekly exam, no mock.
    expect(revise("2026-11-27")).toEqual(["revision:eng:8", "revision:ban:8"]);
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

describe("topicFinishDays", () => {
  it("maps each lecture to the last day it is planned on", () => {
    const days = [
      {
        day: "2026-11-23",
        phase: "learning",
        index: 1,
        capacity: 8,
        items: [
          { kind: "topic", cycles: 2, label: "A", subjectId: "s", topicId: "a" },
          { kind: "topic", cycles: 1, label: "B", subjectId: "s", topicId: "b" },
        ],
      },
      {
        day: "2026-11-24",
        phase: "learning",
        index: 2,
        capacity: 8,
        items: [
          { kind: "topic", cycles: 1, label: "B", subjectId: "s", topicId: "b" },
          { kind: "daily", cycles: 1, label: "V", subjectId: "d" },
        ],
      },
    ] as const;
    const m = topicFinishDays(days as never);
    expect(m.get("a")).toBe("2026-11-23");
    expect(m.get("b")).toBe("2026-11-24");
    expect(m.size).toBe(2);
  });
});
