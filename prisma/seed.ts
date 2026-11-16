import "dotenv/config";
import { clampWeekStart } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDemoData } from "./demo-data";

/**
 * Fills an existing account with demo data.
 *
 *   pnpm db:seed you@example.com           # only if the account is empty
 *   pnpm db:seed you@example.com --reset   # replace that account's data
 *
 * Accounts are created by Supabase Auth, so sign up in the app first.
 * Only the named account is ever touched.
 */
async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const email = args.find((a) => !a.startsWith("--"));
  if (!email) {
    throw new Error("Usage: pnpm db:seed <email> [--reset]");
  }

  const profile = await prisma.profile.findFirst({ where: { email } });
  if (!profile) {
    throw new Error(`No account for ${email}. Sign up in the app first, then run the seed again.`);
  }
  const userId = profile.id;

  const [habitCount, taskCount, blockCount] = await Promise.all([
    prisma.habit.count({ where: { userId } }),
    prisma.task.count({ where: { userId } }),
    prisma.timeBlock.count({ where: { userId } }),
  ]);
  if (habitCount + taskCount + blockCount > 0 && !reset) {
    throw new Error(
      `${email} already has ${habitCount} habits, ${taskCount} tasks and ${blockCount} time blocks. ` +
        "Re-run with --reset to delete them and seed again.",
    );
  }

  const data = buildDemoData(new Date(), {
    timezone: profile.timezone,
    weekStartsOn: clampWeekStart(profile.weekStartsOn),
  });

  await prisma.$transaction(
    async (tx) => {
      if (reset) {
        // Logs, sessions and timer settings cascade from habits and tasks.
        await tx.timeBlock.deleteMany({ where: { userId } });
        await tx.task.deleteMany({ where: { userId } });
        await tx.habit.deleteMany({ where: { userId } });
      }

      const habitIds = new Map<string, string>();
      for (const [sortOrder, { key, logs, ...habit }] of data.habits.entries()) {
        const row = await tx.habit.create({ data: { ...habit, userId, sortOrder } });
        habitIds.set(key, row.id);
        if (logs.length > 0) {
          await tx.habitLog.createMany({
            data: logs.map((log) => ({ ...log, userId, habitId: row.id })),
          });
        }
      }

      const taskIds = new Map<string, string>();
      for (const { key, habitKey, sessions, ...task } of data.tasks) {
        const row = await tx.task.create({
          data: { ...task, userId, habitId: habitKey ? habitIds.get(habitKey) : null },
        });
        taskIds.set(key, row.id);
        if (sessions.length > 0) {
          await tx.pomodoroSession.createMany({
            data: sessions.map((s) => ({ ...s, userId, taskId: row.id })),
          });
        }
      }

      await tx.timeBlock.createMany({
        data: data.blocks.map(({ taskKey, habitKey, ...block }) => ({
          ...block,
          userId,
          taskId: taskKey ? taskIds.get(taskKey) : null,
          habitId: habitKey ? habitIds.get(habitKey) : null,
        })),
      });
    },
    { timeout: 60_000, maxWait: 15_000 },
  );

  const logs = data.habits.reduce((n, h) => n + h.logs.length, 0);
  const sessions = data.tasks.reduce((n, t) => n + t.sessions.length, 0);
  console.log(
    `Seeded ${email}: ${data.habits.length} habits (${logs} check-ins), ${data.tasks.length} tasks ` +
      `(${sessions} timer sessions), ${data.blocks.length} time blocks.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
