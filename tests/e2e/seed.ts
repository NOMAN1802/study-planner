import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { dayKey } from "../../src/lib/dashboard";
import {
  nextPeriodStart,
  periodStart,
  previousPeriodStart,
  type PeriodContext,
  type WeekStart,
} from "../../src/lib/dates";

/**
 * Writes a known data set straight into the database for an existing e2e user
 * and returns the numbers the dashboard must show for it. Expected values are
 * derived from the seeded rows here, not from the dashboard code.
 */

const MIN = 60_000;
/** Prisma stores `timestamp(3)` in UTC; send UTC strings so pg applies no local offset. */
const ts = (d: Date) => d.toISOString();

export type DashboardSeed = {
  /** Local day keys ("YYYY-MM-DD"); index 0 = today, 1 = yesterday, … */
  days: string[];
  focus: { day: number; week: number; month: number };
};

export async function seedDashboard(email: string): Promise<DashboardSeed> {
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    // Fail fast instead of hanging the test if the database is unreachable.
    connectionTimeoutMillis: 15_000,
    query_timeout: 15_000,
  });
  await db.connect();
  try {
    const profile = await db.query<{ id: string; timezone: string; weekStartsOn: number }>(
      'SELECT "id", "timezone", "weekStartsOn" FROM "Profile" WHERE "email" = $1',
      [email],
    );
    if (profile.rowCount !== 1) throw new Error(`No profile for ${email}`);
    const { id: userId, timezone, weekStartsOn } = profile.rows[0];

    const ctx = (frequency: PeriodContext["frequency"]): PeriodContext => ({
      frequency,
      timezone,
      weekStartsOn: weekStartsOn as WeekStart,
    });
    const now = new Date();
    const daily = ctx("DAILY");
    // day[0] = start of today, day[1] = start of yesterday, …
    const day: Date[] = [periodStart(now, daily)];
    for (let i = 1; i <= 6; i += 1) day.push(previousPeriodStart(day[i - 1], daily));
    const dayEnd = nextPeriodStart(day[0], daily);
    const weekStart = periodStart(now, ctx("WEEKLY"));
    const monthStart = periodStart(now, ctx("MONTHLY"));

    // ---- Habits ----
    const habit = async (
      name: string,
      frequency: string,
      targetCount: number | null,
      sortOrder: number,
      createdAt: Date,
    ) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO "Habit" ("id","userId","name","frequency","targetCount","sortOrder","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4::"Frequency",$5,$6,$7,$7)`,
        [id, userId, name, frequency, targetCount, sortOrder, ts(createdAt)],
      );
      return id;
    };
    const log = (habitId: string, periodStartAt: Date, count: number) =>
      db.query(
        `INSERT INTO "HabitLog" ("id","userId","habitId","periodStart","count","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$4)`,
        [randomUUID(), userId, habitId, ts(periodStartAt), count],
      );

    // Read: 2×/day. Complete on days 5, 3, 2, 1; half done on day 4 and today.
    const read = await habit("Read", "DAILY", 2, 0, day[6]);
    for (const [i, count] of [
      [5, 2],
      [4, 1],
      [3, 2],
      [2, 2],
      [1, 2],
      [0, 1],
    ] as const) {
      await log(read, day[i], count);
    }
    // Stretch: no target. Done yesterday and today.
    const stretch = await habit("Stretch", "DAILY", null, 1, day[2]);
    await log(stretch, day[1], 1);
    await log(stretch, day[0], 1);
    // Review: weekly, never done.
    await habit("Review", "WEEKLY", 1, 2, now);

    // ---- Tasks ----
    const task = async (
      title: string,
      status: string,
      dueAt: Date | null,
      targetMinutes: number | null,
      actualMinutes: number,
    ) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO "Task" ("id","userId","title","status","dueAt","targetMinutes","actualMinutes","completedAt","updatedAt")
         VALUES ($1,$2,$3,$4::"TaskStatus",$5,$6,$7,$8,$9)`,
        [
          id,
          userId,
          title,
          status,
          dueAt ? ts(dueAt) : null,
          targetMinutes,
          actualMinutes,
          status === "DONE" ? ts(now) : null,
          ts(now),
        ],
      );
      return id;
    };
    const ship = await task("Ship report", "TODO", new Date(dayEnd.getTime() - MIN), 60, 45);
    await task("Old bug", "TODO", new Date(day[2].getTime() + 12 * 60 * MIN), null, 0);
    await task("Plan sprint", "DONE", new Date(day[0].getTime() + 1000), 30, 40);
    await task("Someday", "TODO", null, 20, 0);

    // ---- Focus sessions (minutes are credited when a session ends) ----
    type Session = { endedAt: Date; startedAt: Date; planned: number; completed: boolean };
    const sessions: (Session & { credited: number })[] = [
      // Completed 25-minute session.
      {
        startedAt: new Date(now.getTime() - 40 * MIN),
        endedAt: new Date(now.getTime() - 15 * MIN),
        planned: 25,
        completed: true,
        credited: 25,
      },
      // Skipped after 10.5 minutes: credits 10 whole minutes.
      {
        startedAt: new Date(now.getTime() - 12 * MIN),
        endedAt: new Date(now.getTime() - 1.5 * MIN),
        planned: 25,
        completed: false,
        credited: 10,
      },
    ];
    // Earlier this week / earlier this month, when such a day exists before today.
    if (day[0] > weekStart) {
      const endedAt = new Date(weekStart.getTime() + 12 * 60 * MIN);
      sessions.push({
        startedAt: new Date(endedAt.getTime() - 50 * MIN),
        endedAt,
        planned: 50,
        completed: true,
        credited: 50,
      });
    }
    if (day[0] > monthStart) {
      const endedAt = new Date(monthStart.getTime() + 9 * 60 * MIN);
      sessions.push({
        startedAt: new Date(endedAt.getTime() - 15 * MIN),
        endedAt,
        planned: 15,
        completed: true,
        credited: 15,
      });
    }
    // Just before this month: must never be counted.
    const beforeMonth = new Date(Math.min(monthStart.getTime(), weekStart.getTime()) - 60 * MIN);
    sessions.push({
      startedAt: new Date(beforeMonth.getTime() - 30 * MIN),
      endedAt: beforeMonth,
      planned: 30,
      completed: true,
      credited: 30,
    });
    for (const s of sessions) {
      await db.query(
        `INSERT INTO "PomodoroSession" ("id","userId","taskId","type","plannedMinutes","startedAt","endedAt","completed")
         VALUES ($1,$2,$3,'FOCUS',$4,$5,$6,$7)`,
        [randomUUID(), userId, ship, s.planned, ts(s.startedAt), ts(s.endedAt), s.completed],
      );
    }
    // A completed break in the same window: breaks are not focus time.
    await db.query(
      `INSERT INTO "PomodoroSession" ("id","userId","taskId","type","plannedMinutes","startedAt","endedAt","completed")
       VALUES ($1,$2,$3,'SHORT_BREAK',5,$4,$5,true)`,
      [
        randomUUID(),
        userId,
        ship,
        ts(new Date(now.getTime() - 8 * MIN)),
        ts(new Date(now.getTime() - 3 * MIN)),
      ],
    );

    const creditedSince = (from: Date, to: Date) =>
      sessions
        .filter((s) => s.endedAt >= from && s.endedAt < to)
        .reduce((sum, s) => sum + s.credited, 0);

    return {
      days: day.map((d) => dayKey(d, timezone)),
      focus: {
        day: creditedSince(day[0], dayEnd),
        week: creditedSince(weekStart, nextPeriodStart(weekStart, ctx("WEEKLY"))),
        month: creditedSince(monthStart, nextPeriodStart(monthStart, ctx("MONTHLY"))),
      },
    };
  } finally {
    await db.end();
  }
}
