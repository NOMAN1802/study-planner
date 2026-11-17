-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "parts" JSONB NOT NULL DEFAULT '[]';
