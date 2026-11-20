import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PracticeRunner } from "@/components/workstation/practice-runner";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPracticeQuestions, lecturesOf } from "@/lib/workstation/exam-server";

export const metadata: Metadata = { title: "Practice" };

const SIZES = [10, 20, 50];

export default async function PracticePage({ searchParams }: PageProps<"/work-station/practice">) {
  const params = await searchParams;
  const raw = params.topic;
  const topicIds = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
    (v) => z.uuid().safeParse(v).success,
  );
  const n = Number(Array.isArray(params.n) ? params.n[0] : params.n);
  const count = SIZES.includes(n) ? n : 20;

  const user = await requireUser();
  const plan = await prisma.studyPlan.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  const lectures = plan ? await lecturesOf(user, plan.id, topicIds) : [];
  const questions = await getPracticeQuestions(user, lectures, count);
  const again = `/work-station/practice?${new URLSearchParams([
    ...topicIds.map((t) => ["topic", t]),
    ["n", String(count)],
  ]).toString()}`;

  return (
    <div className="enter mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <Link
          href="/work-station/exams"
          className="mb-1 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Exams
        </Link>
        <p className="text-sm text-fg-muted">
          {lectures.length} {lectures.length === 1 ? "topic" : "topics"} · {questions.length}{" "}
          questions
        </p>
      </div>
      {questions.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-fg-muted">
          No questions for the topics picked. Go back and pick topics that have questions.
        </p>
      ) : (
        <PracticeRunner
          key={questions.map((q) => q.id).join(",")}
          questions={questions.map((q) => ({
            id: q.id,
            text: q.text,
            options: q.options,
            answer: q.answer ?? 0,
            explanation: q.explanation,
            source: q.source,
            section: q.section,
          }))}
          again={again}
        />
      )}
    </div>
  );
}
