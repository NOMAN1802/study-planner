"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EXAM_SPEC,
  SUBMIT_GRACE_MS,
  TAKEN_EXAM_KINDS,
  applyAnswers,
  deadlineOf,
  markExam,
  parseRecords,
} from "@/lib/workstation/exam";
import { examScope, pickExamQuestions } from "@/lib/workstation/exam-server";

export type StartExamState = { error?: string };

const startSchema = z.object({
  kind: z.enum(TAKEN_EXAM_KINDS),
  subjectId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
});

function revalidate() {
  revalidatePath("/work-station");
  revalidatePath("/dashboard");
}

/** Marks an exam with the answers given and closes it. */
async function finish(
  exam: { id: string; questions: unknown },
  answers: Readonly<Record<string, unknown>> | null,
  at: Date,
) {
  const records = parseRecords(exam.questions) ?? [];
  const final = answers ? applyAnswers(records, answers) : records;
  const keys = await prisma.question.findMany({
    where: { id: { in: final.map((r) => r.id) } },
    select: { id: true, answer: true },
  });
  const answerOf = new Map(keys.map((k) => [k.id, k.answer]));
  const marking = markExam(final, (id) => answerOf.get(id));
  await prisma.studyExam.update({
    where: { id: exam.id },
    data: {
      questions: final,
      score: marking.score,
      total: marking.total,
      submittedAt: at,
      note: `${marking.correct} correct · ${marking.wrong} wrong · ${marking.unanswered} unanswered`,
    },
  });
}

/** Starts a daily, weekly or subject-final exam and opens it. */
export async function startExam(
  _prev: StartExamState,
  formData: FormData,
): Promise<StartExamState> {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    kind: formData.get("kind"),
    subjectId: formData.get("subjectId") ?? undefined,
  });
  if (!parsed.success) return { error: "Pick an exam." };
  const { kind, subjectId } = parsed.data;

  const plan = await prisma.studyPlan.findUnique({
    where: { userId: user.id },
    select: { id: true, subjects: { select: { id: true, name: true } } },
  });
  if (!plan) return { error: "Set up your study plan first." };
  const subject = subjectId ? plan.subjects.find((s) => s.id === subjectId) : undefined;
  if (kind === "SUBJECT_FINAL" && !subject) return { error: "Pick the subject." };

  const now = new Date();
  // One exam at a time: finish one whose time is up, or go back to one still running.
  const open = await prisma.studyExam.findFirst({
    where: { planId: plan.id, startedAt: { not: null }, submittedAt: null },
    select: { id: true, questions: true, startedAt: true, durationSec: true },
  });
  if (open?.startedAt && open.durationSec) {
    const closes = deadlineOf(open.startedAt, open.durationSec).getTime() + SUBMIT_GRACE_MS;
    if (closes > now.getTime()) redirect(`/work-station/exam/${open.id}`);
    await finish(open, null, now);
  }

  const ids = await pickExamQuestions(user, plan.id, kind, subject?.name, now);
  if (ids.length === 0) {
    return {
      error:
        kind === "SUBJECT_FINAL"
          ? `No questions in the bank for ${subject?.name} yet.`
          : kind === "DAILY"
            ? "No questions yet for the lectures you ticked done today."
            : "No questions yet for the lectures you ticked done this week.",
    };
  }

  const exam = await prisma.studyExam.create({
    data: {
      planId: plan.id,
      kind,
      subjectId: subject?.id ?? null,
      day: examScope(user, now).today,
      questions: ids.map((id) => ({ id, chosen: null })),
      total: ids.length,
      startedAt: now,
      durationSec: EXAM_SPEC[kind].minutes * 60,
    },
    select: { id: true },
  });
  revalidate();
  redirect(`/work-station/exam/${exam.id}`);
}

const answersSchema = z.record(z.string(), z.number().int().min(0).max(3).nullable());

/**
 * Submits an exam's answer sheet and marks it. Answers sent after the time is up
 * (plus a short grace for slow networks) are not counted.
 */
export async function submitExam(examId: string, answers: unknown): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(examId).success) return { error: "Exam not found." };
  const sheet = answersSchema.safeParse(answers);
  if (!sheet.success) return { error: "Could not read your answers." };

  const exam = await prisma.studyExam.findFirst({
    where: { id: examId, plan: { userId: user.id } },
    select: { id: true, questions: true, startedAt: true, durationSec: true, submittedAt: true },
  });
  if (!exam || !exam.startedAt || !exam.durationSec) return { error: "Exam not found." };
  if (exam.submittedAt) {
    refresh();
    return {};
  }

  const now = new Date();
  const closes = deadlineOf(exam.startedAt, exam.durationSec).getTime() + SUBMIT_GRACE_MS;
  await finish(exam, now.getTime() <= closes ? sheet.data : null, now);
  revalidate();
  refresh();
  return {};
}
