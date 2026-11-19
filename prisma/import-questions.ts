import "dotenv/config";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { bankFileSchema, expandBank, type QuestionRow } from "@/lib/workstation/question-bank";

/**
 * Loads question-bank files into the shared question bank.
 *
 *   pnpm db:questions Doc/question-bank/english-literature.json [more.json …]
 *
 * Questions are replaced by id (`<section>-<number>`), so running it again
 * after adding questions to a file updates the bank without duplicates.
 * Nothing is written if any file has a problem.
 */
async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    throw new Error("Usage: pnpm db:questions <bank.json> [more.json …]");
  }

  const rows: QuestionRow[] = [];
  const problems: string[] = [];
  for (const path of paths) {
    const parsed = bankFileSchema.safeParse(JSON.parse(await readFile(path, "utf8")));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      problems.push(`${path}: ${issues.join("; ")}`);
      continue;
    }
    const bank = expandBank(parsed.data);
    problems.push(...bank.problems.map((p) => `${path}: ${p}`));
    rows.push(...bank.rows);
  }
  if (problems.length > 0) throw new Error(`Nothing imported:\n${problems.join("\n")}`);

  // Replace these ids in two bulk statements (one upsert per row is too slow over the pooler).
  // Ids are stable, so exams already taken still point at the right questions.
  await prisma.$transaction(
    async (tx) => {
      await tx.question.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      await tx.question.createMany({ data: rows });
    },
    { maxWait: 30_000, timeout: 60_000 },
  );
  const bySection = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.lecture} · ${r.section}`;
    bySection.set(key, (bySection.get(key) ?? 0) + 1);
  }
  for (const [key, n] of bySection) console.log(`${String(n).padStart(4)}  ${key}`);
  console.log(`Imported ${rows.length} questions.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
