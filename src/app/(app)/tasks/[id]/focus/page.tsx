import { ArrowLeft, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LectureLinks } from "@/components/workstation/lecture-links";
import { lectureParts } from "@/lib/workstation/lecture-parts";
import { savePomodoroConfig } from "@/actions/pomodoro";
import { PomodoroSettingsForm } from "@/components/pomodoro/pomodoro-settings-form";
import { PomodoroTimer } from "@/components/pomodoro/pomodoro-timer";
import { SessionHistory } from "@/components/pomodoro/session-history";
import { PriorityBadge } from "@/components/tasks/badges";
import { requireUser } from "@/lib/auth";
import { getSessionHistory, getTimerSnapshot } from "@/lib/pomodoro-server";
import { prisma } from "@/lib/prisma";
import type { TaskPriority } from "@/schemas/task";

export const metadata: Metadata = { title: "Focus" };

export default async function FocusPage({ params, searchParams }: PageProps<"/tasks/[id]/focus">) {
  const { id } = await params;
  const { topic: topicParam } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const task = await prisma.task.findFirst({
    where: { id, userId: user.id },
    include: { habit: { select: { name: true, color: true } } },
  });
  if (!task) notFound();

  const study = task.category === "STUDY";
  const topicId =
    typeof topicParam === "string" && z.uuid().safeParse(topicParam).success ? topicParam : null;
  const topic =
    study && topicId
      ? await prisma.topic.findFirst({
          where: { id: topicId, subject: { taskId: task.id, plan: { userId: user.id } } },
          select: { id: true, title: true, url: true, parts: true },
        })
      : null;
  const back = study
    ? { href: "/work-station", label: "Study Station" }
    : { href: "/tasks", label: "Tasks" };

  const [snapshot, history] = await Promise.all([
    getTimerSnapshot(user, task.id),
    getSessionHistory(user.id, task.id),
  ]);

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={back.href}
            className="mb-1 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {back.label}
          </Link>
          <h2 className="truncate font-display text-xl font-semibold tracking-tight">
            {task.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
            <PriorityBadge priority={task.priority as TaskPriority} />
            <span
              className="inline-flex items-center gap-1 font-mono tabular-nums"
              data-testid="task-actual"
            >
              <Clock className="size-3.5" aria-hidden />
              {task.actualMinutes}
              {task.targetMinutes ? `/${task.targetMinutes}` : ""} min focused
            </span>
            {task.habit ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: task.habit.color }}
                  aria-hidden
                />
                Counts toward {task.habit.name}
              </span>
            ) : null}
          </div>
          {topic ? (
            <p
              className="mt-2 flex flex-wrap items-center gap-x-2 text-sm"
              data-testid="focus-topic"
            >
              <span className="text-fg-muted">Studying</span>
              <span className="font-medium text-fg">{topic.title}</span>
              <span className="inline-flex flex-wrap items-center gap-x-2 text-xs">
                <LectureLinks parts={lectureParts(topic.parts, topic.url)} />
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <PomodoroTimer taskTitle={task.title} initial={snapshot} topicId={topic?.id ?? null} />
        <div className="flex flex-col gap-4">
          <section
            aria-labelledby="settings-heading"
            className="rounded-lg border border-border bg-surface p-4"
          >
            <h3 id="settings-heading" className="mb-3 text-sm font-medium">
              Timer settings
            </h3>
            <PomodoroSettingsForm
              action={savePomodoroConfig.bind(null, task.id)}
              settings={snapshot.settings}
            />
          </section>
          <section
            aria-labelledby="history-heading"
            className="rounded-lg border border-border bg-surface p-4"
          >
            <h3 id="history-heading" className="mb-2 text-sm font-medium">
              Recent sessions
            </h3>
            <SessionHistory items={history} timezone={user.timezone} />
          </section>
        </div>
      </div>
    </div>
  );
}
