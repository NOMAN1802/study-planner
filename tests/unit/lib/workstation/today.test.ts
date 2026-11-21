import { describe, expect, it } from "vitest";
import type { PlanItem } from "@/lib/workstation/schedule";
import { itemKeys, todayItems, todayProgress } from "@/lib/workstation/today";

const items: PlanItem[] = [
  { kind: "daily", cycles: 1, label: "Words 1–10", subjectId: "v", topicId: "v-1" },
  { kind: "topic", cycles: 2, label: "Lit 01", subjectId: "e", topicId: "e-1" },
  { kind: "topic", cycles: 2, label: "Lit 02", subjectId: "e", topicId: "e-2" },
  { kind: "weekly-revision", cycles: 3, label: "Weekly revision" },
  { kind: "weekly-exam", cycles: 1, label: "Weekly exam" },
  { kind: "revision", cycles: 2, label: "Revise E", subjectId: "e" },
  { kind: "revision", cycles: 2, label: "Revise E", subjectId: "e" },
];

const none = { doneTopicIds: new Set<string>(), checkedKeys: new Set<string>(), examsToday: [] };

describe("today items", () => {
  it("keys lectures by topic and numbers repeats of other items", () => {
    expect(itemKeys(items)).toEqual([
      "daily:v:0",
      "topic:e-1",
      "topic:e-2",
      "weekly-revision::0",
      "weekly-exam::0",
      "revision:e:0",
      "revision:e:1",
    ]);
  });

  it("ticks lectures by topic, exams by a recorded result and the rest by checks", () => {
    const list = todayItems(items, {
      doneTopicIds: new Set(["e-1"]),
      checkedKeys: new Set(["daily:v:0", "revision:e:1"]),
      examsToday: [{ kind: "WEEKLY", subjectId: null }],
    });
    expect(list.map((i) => `${i.via}:${i.done}`)).toEqual([
      "check:true",
      "topic:true",
      "topic:false",
      "check:false",
      "exam:true",
      "check:false",
      "check:true",
    ]);
    expect(todayProgress(list)).toEqual({ done: 6, total: 13, complete: false });
  });

  it("is complete once every item is ticked, and never for an empty day", () => {
    const list = todayItems(items.slice(0, 2), {
      ...none,
      doneTopicIds: new Set(["e-1"]),
      checkedKeys: new Set(["daily:v:0"]),
    });
    expect(todayProgress(list)).toEqual({ done: 3, total: 3, complete: true });
    expect(todayProgress([]).complete).toBe(false);
  });

  it("matches a subject final to its own subject", () => {
    const final: PlanItem[] = [
      { kind: "subject-final", cycles: 1, label: "E final", subjectId: "e" },
    ];
    const other = todayItems(final, {
      ...none,
      examsToday: [{ kind: "SUBJECT_FINAL", subjectId: "b" }],
    });
    const own = todayItems(final, {
      ...none,
      examsToday: [{ kind: "SUBJECT_FINAL", subjectId: "e" }],
    });
    expect(other[0].done).toBe(false);
    expect(own[0].done).toBe(true);
  });
});
