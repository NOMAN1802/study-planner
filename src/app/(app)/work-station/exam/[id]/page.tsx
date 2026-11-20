import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDay } from "@/components/workstation/format";
import { ExamReview } from "@/components/workstation/exam-review";
import { ExamRunner } from "@/components/workstation/exam-runner";
import { requireUser } from "@/lib/auth";
import { getExamSheet } from "@/lib/workstation/exam-server";
import { EXAM_LABEL } from "@/schemas/workstation";

export const metadata: Metadata = { title: "Exam" };

export default async function ExamPage({ params }: PageProps<"/work-station/exam/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const sheet = await getExamSheet(user, id);
  if (!sheet) notFound();

  const title = `${EXAM_LABEL[sheet.kind]}${sheet.subjectName ? ` · ${sheet.subjectName}` : ""}`;

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
          {formatDay(sheet.day)} · {sheet.questions.length} questions
        </p>
      </div>
      {sheet.submittedAt ? (
        <ExamReview sheet={sheet} title={title} />
      ) : (
        <ExamRunner
          examId={sheet.id}
          title={title}
          deadline={sheet.deadline}
          serverNow={new Date().toISOString()}
          questions={sheet.questions.map(({ id: qid, text, options, section }) => ({
            id: qid,
            text,
            options,
            section,
          }))}
        />
      )}
    </div>
  );
}
