"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";
import {
  BREAK_MINUTES,
  FOCUS_MINUTES,
  defaultRoutine,
  overlappingSlot,
  type RoutineKind,
} from "@/lib/workstation/routine";
import { getRoutineSlots } from "@/lib/workstation/server";
import {
  estimateSchema,
  examSchema,
  firstErrors,
  formValues,
  planLengthSchema,
  setupSchema,
  slotSchema,
  type ExamField,
  type ExamState,
  type PlanLengthField,
  type PlanLengthState,
  type SetupField,
  type SetupState,
  type SlotField,
  type SlotState,
} from "@/schemas/workstation";

const idSchema = z.uuid();
type Result = { error?: string };

function revalidate() {
  revalidatePath("/work-station");
  revalidatePath("/dashboard");
}

async function ownedPlan(userId: string) {
  return prisma.studyPlan.findUnique({ where: { userId }, select: { id: true } });
}

export async function setupPlan(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const user = await requireUser();
  const parsed = setupSchema.safeParse(
    formValues(formData, ["startDay", "learningDays", "revisionDays"]),
  );
  if (!parsed.success) return { fieldErrors: firstErrors<SetupField>(parsed.error) };
  if (await ownedPlan(user.id)) return { error: "You already have a study plan." };

  // Ids are generated here so everything can be inserted with a few bulk writes.
  const planId = randomUUID();
  const subjects = BCS_SYLLABUS.map((s, i) => ({
    ...s,
    id: randomUUID(),
    taskId: randomUUID(),
    i,
  }));
  const hasRoutine = (await prisma.routineSlot.count({ where: { userId: user.id } })) > 0;

  await prisma.$transaction([
    prisma.studyPlan.create({
      data: { id: planId, userId: user.id, name: "BCS Preliminary", ...parsed.data },
    }),
    prisma.task.createMany({
      data: subjects.map((s) => ({
        id: s.taskId,
        userId: user.id,
        title: `BCS · ${s.name}`,
        category: "STUDY" as const,
        status: "IN_PROGRESS" as const,
      })),
    }),
    prisma.pomodoroConfig.createMany({
      data: subjects.map((s) => ({
        userId: user.id,
        taskId: s.taskId,
        focusMinutes: FOCUS_MINUTES,
        shortBreakMinutes: BREAK_MINUTES,
        longBreakMinutes: BREAK_MINUTES,
        cyclesBeforeLongBreak: 4,
        autoStartNext: true,
      })),
    }),
    prisma.subject.createMany({
      data: subjects.map((s) => ({
        id: s.id,
        planId,
        taskId: s.taskId,
        name: s.name,
        color: s.color,
        sortOrder: s.i,
        isDaily: Boolean(s.isDaily),
        resourceFile: s.resourceFile,
      })),
    }),
    prisma.topic.createMany({
      data: subjects.flatMap((s) =>
        s.topics.map((t, j) => ({ subjectId: s.id, sortOrder: j, title: t.title, url: t.url })),
      ),
    }),
    ...(hasRoutine
      ? []
      : [
          prisma.routineSlot.createMany({
            data: defaultRoutine().map((slot) => ({ ...slot, userId: user.id })),
          }),
        ]),
    // Friday is the weekly holiday, so weeks run Saturday–Friday.
    prisma.profile.update({ where: { id: user.id }, data: { weekStartsOn: 6 } }),
  ]);

  revalidate();
  revalidatePath("/settings");
  redirect("/work-station");
}

/** Changes the learning/revision split of the plan; progress is kept. */
export async function updatePlanLength(
  _prev: PlanLengthState,
  formData: FormData,
): Promise<PlanLengthState> {
  const user = await requireUser();
  const parsed = planLengthSchema.safeParse(formValues(formData, ["learningDays", "revisionDays"]));
  if (!parsed.success) return { fieldErrors: firstErrors<PlanLengthField>(parsed.error) };
  const { count } = await prisma.studyPlan.updateMany({
    where: { userId: user.id },
    data: parsed.data,
  });
  if (count === 0) return { error: "Set up your study plan first." };
  revalidate();
  return { ok: true };
}

/** Deletes the plan, its subjects and their study tasks (sessions go with them). */
export async function resetPlan(): Promise<Result> {
  const user = await requireUser();
  const plan = await prisma.studyPlan.findUnique({
    where: { userId: user.id },
    select: { id: true, subjects: { select: { taskId: true } } },
  });
  if (!plan) return { error: "No study plan to reset." };
  await prisma.$transaction([
    prisma.studyPlan.delete({ where: { id: plan.id } }),
    prisma.task.deleteMany({
      where: { userId: user.id, id: { in: plan.subjects.map((s) => s.taskId) } },
    }),
  ]);
  revalidate();
  return {};
}

async function ownedTopic(userId: string, topicId: string) {
  if (!idSchema.safeParse(topicId).success) return null;
  return prisma.topic.findFirst({
    where: { id: topicId, subject: { plan: { userId } } },
    select: { id: true },
  });
}

export async function setTopicDone(topicId: string, done: boolean): Promise<Result> {
  const user = await requireUser();
  const topic = await ownedTopic(user.id, topicId);
  if (!topic) return { error: "Topic not found." };
  await prisma.topic.update({
    where: { id: topic.id },
    data: { doneAt: done ? new Date() : null },
  });
  revalidate();
  return {};
}

export async function setTopicEstimate(topicId: string, value: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = estimateSchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid estimate." };
  const topic = await ownedTopic(user.id, topicId);
  if (!topic) return { error: "Topic not found." };
  await prisma.topic.update({ where: { id: topic.id }, data: { estCycles: parsed.data } });
  revalidate();
  return {};
}

/** Swaps a subject with its neighbour in study order (the daily subject is not ordered). */
export async function moveSubject(subjectId: string, direction: -1 | 1): Promise<Result> {
  const user = await requireUser();
  if (!idSchema.safeParse(subjectId).success || (direction !== -1 && direction !== 1))
    return { error: "Subject not found." };
  const plan = await prisma.studyPlan.findUnique({
    where: { userId: user.id },
    select: {
      subjects: {
        where: { isDaily: false },
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true },
      },
    },
  });
  const list = plan?.subjects ?? [];
  const i = list.findIndex((s) => s.id === subjectId);
  if (i === -1) return { error: "Subject not found." };
  const j = i + direction;
  if (j < 0 || j >= list.length) return {};
  // Renumber everything so ties from older data can't make a swap a no-op.
  const order = list.map((s) => s.id);
  [order[i], order[j]] = [order[j], order[i]];
  await prisma.$transaction(
    order.map((id, k) => prisma.subject.update({ where: { id }, data: { sortOrder: k } })),
  );
  revalidate();
  return {};
}

export async function saveSlot(
  slotId: string | null,
  _prev: SlotState,
  formData: FormData,
): Promise<SlotState> {
  const user = await requireUser();
  const parsed = slotSchema.safeParse(
    formValues(formData, ["weekday", "start", "end", "kind", "label"]),
  );
  if (!parsed.success) return { fieldErrors: firstErrors<SlotField>(parsed.error) };
  const { weekday, start, end, kind, label } = parsed.data;

  const slots = await getRoutineSlots(user.id);
  if (slotId !== null && !slots.some((s) => s.id === slotId)) return { error: "Slot not found." };
  const clash = overlappingSlot(slots, {
    id: slotId ?? undefined,
    weekday,
    startMin: start,
    endMin: end,
    kind: kind as RoutineKind,
    label,
  });
  if (clash) return { fieldErrors: { start: `Overlaps “${clash.label}”` } };

  const data = { weekday, startMin: start, endMin: end, kind: kind as RoutineKind, label };
  if (slotId === null) await prisma.routineSlot.create({ data: { ...data, userId: user.id } });
  else await prisma.routineSlot.update({ where: { id: slotId }, data });
  revalidate();
  return { ok: true };
}

export async function deleteSlot(slotId: string): Promise<Result> {
  const user = await requireUser();
  if (!idSchema.safeParse(slotId).success) return { error: "Slot not found." };
  const { count } = await prisma.routineSlot.deleteMany({ where: { id: slotId, userId: user.id } });
  if (count === 0) return { error: "Slot not found." };
  revalidate();
  return {};
}

export async function resetRoutine(): Promise<Result> {
  const user = await requireUser();
  await prisma.$transaction([
    prisma.routineSlot.deleteMany({ where: { userId: user.id } }),
    prisma.routineSlot.createMany({
      data: defaultRoutine().map((slot) => ({ ...slot, userId: user.id })),
    }),
  ]);
  revalidate();
  return {};
}

export async function recordExam(_prev: ExamState, formData: FormData): Promise<ExamState> {
  const user = await requireUser();
  const plan = await ownedPlan(user.id);
  if (!plan) return { error: "Set up your study plan first." };
  const parsed = examSchema.safeParse(
    formValues(formData, ["kind", "day", "subjectId", "score", "total", "note"]),
  );
  if (!parsed.success) return { fieldErrors: firstErrors<ExamField>(parsed.error) };
  const { subjectId } = parsed.data;
  if (subjectId) {
    const owned = await prisma.subject.findFirst({
      where: { id: subjectId, planId: plan.id },
      select: { id: true },
    });
    if (!owned) return { fieldErrors: { subjectId: "Pick the subject" } };
  }
  await prisma.studyExam.create({ data: { ...parsed.data, planId: plan.id } });
  revalidate();
  return { ok: true };
}

export async function deleteExam(examId: string): Promise<Result> {
  const user = await requireUser();
  if (!idSchema.safeParse(examId).success) return { error: "Exam not found." };
  const { count } = await prisma.studyExam.deleteMany({
    where: { id: examId, plan: { userId: user.id } },
  });
  if (count === 0) return { error: "Exam not found." };
  revalidate();
  return {};
}
