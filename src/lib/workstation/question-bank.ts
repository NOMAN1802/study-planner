/**
 * Question-bank files (Doc/question-bank/*.json, kept out of git because they
 * are transcribed from books) and how they become `Question` rows.
 *
 * A file holds one subject, split into sections; every section names the
 * lecture (as titled in BCS_SYLLABUS) its questions belong to. A question's
 * id is `<section id>-<number in the section>`, so re-importing an edited or
 * longer file updates questions in place.
 */
import { z } from "zod";
import { BCS_SYLLABUS } from "@/lib/workstation/bcs-syllabus";

const bankQuestion = z.object({
  /** Question text. */
  q: z.string().trim().min(1),
  /** The four options, A–D. */
  o: z.array(z.string().trim().min(1)).length(4),
  /** Index (0–3) of the correct option. */
  a: z.number().int().min(0).max(3),
  /** Where it was asked, e.g. "37th BCS". */
  s: z.string().trim().min(1).optional(),
  /** Short explanation shown after marking. */
  x: z.string().trim().min(1).optional(),
});

const bankSection = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Section ids use a-z, 0-9 and dashes"),
  title: z.string().trim().min(1),
  lecture: z.string().trim().min(1),
  questions: z.array(bankQuestion).min(1),
});

export const bankFileSchema = z.object({
  subject: z.string().trim().min(1),
  source: z.string().optional(),
  sections: z.array(bankSection).min(1),
});
export type BankFile = z.infer<typeof bankFileSchema>;

export type QuestionRow = {
  id: string;
  subject: string;
  lecture: string;
  section: string;
  text: string;
  options: string[];
  answer: number;
  explanation: string | null;
  source: string | null;
};

/** Expands a bank file into rows, with any problems (unknown subject or lecture, duplicate ids). */
export function expandBank(file: BankFile): { rows: QuestionRow[]; problems: string[] } {
  const problems: string[] = [];
  const subject = BCS_SYLLABUS.find((s) => s.name === file.subject);
  if (!subject) problems.push(`Unknown subject "${file.subject}"`);
  const lectures = new Set(subject?.topics.map((t) => t.title));
  const seen = new Set<string>();
  const rows: QuestionRow[] = [];
  for (const section of file.sections) {
    if (seen.has(section.id)) problems.push(`Duplicate section id "${section.id}"`);
    seen.add(section.id);
    if (subject && !lectures.has(section.lecture)) {
      problems.push(
        `Section "${section.title}": no lecture "${section.lecture}" in ${file.subject}`,
      );
    }
    section.questions.forEach((q, i) => {
      rows.push({
        id: `${section.id}-${String(i + 1).padStart(3, "0")}`,
        subject: file.subject,
        lecture: section.lecture,
        section: section.title,
        text: q.q,
        options: q.o,
        answer: q.a,
        explanation: q.x ?? null,
        source: q.s ?? null,
      });
    });
  }
  return { rows, problems };
}
