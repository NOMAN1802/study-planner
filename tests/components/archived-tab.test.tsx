import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArchivedTab } from "@/components/workstation/archived-tab";
import type { SubjectProjection } from "@/lib/workstation/schedule";
import type { WsExam, WsSubject, WsTopic } from "@/lib/workstation/server";

vi.mock("@/actions/workstation", () => ({ setTopicDone: vi.fn(async () => ({})) }));

const topic = (id: string, over: Partial<WsTopic> = {}): WsTopic => ({
  id,
  title: `Lecture ${id}`,
  parts: [{ title: `Lecture ${id}`, url: `https://youtu.be/${id}` }],
  estCycles: 2,
  done: false,
  doneDay: null,
  spentCycles: 0,
  book: null,
  ...over,
});

const subject = (id: string, topics: WsTopic[]): WsSubject => ({
  id,
  taskId: `task-${id}`,
  name: id === "eng" ? "English" : "Bangla",
  color: "#123456",
  isDaily: false,
  resourceFile: null,
  topics,
});

const projection = (subjectId: string, status: SubjectProjection["status"]): SubjectProjection => ({
  subjectId,
  status,
  doneTopics: 0,
  totalTopics: 0,
  remainingCycles: 0,
  projectedStart: null,
  projectedEnd: null,
});

const exam = (over: Partial<WsExam>): WsExam => ({
  id: "x",
  kind: "WEEKLY",
  day: "2026-11-27",
  subjectId: null,
  score: 40,
  total: 50,
  note: null,
  taken: false,
  inProgress: false,
  ...over,
});

describe("ArchivedTab", () => {
  it("lists done lectures by subject, latest first, with hours, links and totals", () => {
    const subjects = [
      subject("eng", [
        topic("e1", { done: true, doneDay: "2026-11-21", spentCycles: 2, book: "Literary Terms" }),
        topic("e2", { done: true, doneDay: "2026-11-23", spentCycles: 3 }),
        topic("e3"),
      ]),
      subject("ban", [topic("b1")]),
    ];
    render(
      <ArchivedTab
        subjects={subjects}
        projections={[projection("eng", "current"), projection("ban", "upcoming")]}
        exams={[]}
      />,
    );
    expect(screen.getByTestId("ws-archived-lectures")).toHaveTextContent("2/4");
    expect(screen.getByTestId("ws-archived-hours")).toHaveTextContent("5 h");
    expect(screen.getAllByTestId("ws-archived-group")).toHaveLength(1);
    const rows = screen.getAllByTestId("ws-archived-topic");
    expect(rows.map((r) => within(r).getByText(/^Lecture e/).textContent)).toEqual([
      "Lecture e2",
      "Lecture e1",
    ]);
    expect(within(rows[0]).getByText("Done Mon 23 Nov")).toBeInTheDocument();
    expect(within(rows[0]).getByTestId("ws-archived-topic-hours")).toHaveTextContent("3 h spent");
    expect(within(rows[1]).getByRole("link", { name: /Book \(PDF\)/ })).toHaveAttribute(
      "href",
      "/work-station/book/e1",
    );
    // Un-ticking sends the lecture back.
    expect(
      within(rows[0]).getByRole("checkbox", { name: "Mark Lecture e2 as not done" }),
    ).toBeChecked();
    expect(screen.getByText(/A subject lands here/)).toBeInTheDocument();
  });

  it("shows finished subjects and past exams, newest first, without ones in progress", () => {
    const subjects = [
      subject("eng", [topic("e1", { done: true, doneDay: "2026-11-21", spentCycles: 2 })]),
    ];
    render(
      <ArchivedTab
        subjects={subjects}
        projections={[projection("eng", "done")]}
        exams={[
          exam({ id: "a", day: "2026-11-27", score: 40, total: 50 }),
          exam({
            id: "b",
            kind: "SUBJECT_FINAL",
            subjectId: "eng",
            day: "2026-12-01",
            score: 18,
            total: 20,
          }),
          exam({ id: "c", day: "2026-12-04", inProgress: true }),
        ]}
      />,
    );
    const finished = screen.getByTestId("ws-archived-subject");
    expect(finished).toHaveTextContent("English");
    expect(finished).toHaveTextContent("1 lecture · 2 h · Sat 21 Nov");
    expect(screen.getByTestId("ws-archived-subjects")).toHaveTextContent("1");
    const past = screen.getAllByTestId("ws-archived-exam");
    expect(past).toHaveLength(2);
    expect(past[0]).toHaveTextContent("English");
    expect(past[0]).toHaveTextContent("18/20");
    expect(past[0]).toHaveTextContent("90%");
    expect(past[1]).toHaveTextContent("40/50");
    expect(screen.getByTestId("ws-archived-exams")).toHaveTextContent("2");
  });
});
