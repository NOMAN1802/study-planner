-- AlterTable
ALTER TABLE "StudyPlan" ADD COLUMN     "holidays" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "learningDays" SET DEFAULT 80;
