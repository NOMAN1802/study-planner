-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "parts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preset" TEXT;

-- AlterTable
ALTER TABLE "HabitLog" ADD COLUMN     "parts" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "HabitDayNote" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitDayNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HabitDayNote_userId_day_key" ON "HabitDayNote"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Habit_userId_preset_key" ON "Habit"("userId", "preset");

-- AddForeignKey
ALTER TABLE "HabitDayNote" ADD CONSTRAINT "HabitDayNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
