-- CreateTable
CREATE TABLE "StudyCheck" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cycles" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyCheck_planId_day_key_key" ON "StudyCheck"("planId", "day", "key");

-- AddForeignKey
ALTER TABLE "StudyCheck" ADD CONSTRAINT "StudyCheck_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
