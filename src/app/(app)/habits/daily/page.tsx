import type { Metadata } from "next";
import { AddSetButton } from "@/components/daily-habits/add-set-button";
import { DailyChecklist } from "@/components/daily-habits/daily-checklist";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { getDailyChecklist, todayKey } from "@/lib/daily-habits-server";
import { isDayKey } from "@/lib/planner";

export const metadata: Metadata = { title: "Daily habits" };

export default async function DailyHabitsPage({ searchParams }: PageProps<"/habits/daily">) {
  const user = await requireUser();
  const { date } = await searchParams;
  const today = todayKey(user);
  const raw = Array.isArray(date) ? date[0] : date;
  // Future days can't be ticked, so they fall back to today.
  const day = isDayKey(raw) && raw <= today ? raw : today;
  const data = await getDailyChecklist(user, day);

  return (
    <div className="enter mx-auto flex w-full max-w-2xl flex-col gap-4">
      {data.habits.length === 0 ? (
        <EmptyState
          title="No daily habits yet"
          description="Add the daily set — Prayer (Fajr, Dhuhr, Asr, Maghrib, Isha), Exercise 5 min, Bath before Fajr, No sugar, Screen time under 2 hours, No junk food, Learn a new technology, Read Quran 10 min, Sleep 11 pm – 5 am and Study at least 7 hours — or create your own daily habit."
          action={<AddSetButton />}
        />
      ) : (
        <>
          <DailyChecklist key={day} data={data} />
          {data.hasSet ? null : (
            <div className="flex flex-col gap-2 rounded-sm border border-dashed border-border-strong p-4">
              <p className="text-sm text-fg-muted">
                Add the daily set (prayer, exercise, Quran, sleep, study and more) next to your own
                habits.
              </p>
              <AddSetButton variant="secondary" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
