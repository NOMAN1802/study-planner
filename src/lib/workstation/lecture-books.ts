/**
 * Lecture books: for each lecture, the pages of its subject's book that cover
 * it. The books themselves are paid material, so they never enter the repo:
 * `pnpm books:upload` slices them locally (Doc/study-resource, git-ignored)
 * into one compressed PDF per lecture and uploads those to the private
 * `lecture-books` Supabase Storage bucket, read through signed links only.
 *
 * Page numbers are PDF pages (not the book's printed numbers). Books are
 * split by chapter, not by lecture, so a lecture spread over several videos
 * of one chapter (e.g. Preposition-1 and -2) gets the whole chapter.
 */

export type LectureBook = {
  /** Source PDF in Doc/study-resource. */
  file: string;
  /** Folder in the bucket. */
  folder: string;
  /** Short name shown on the link. */
  name: string;
};

export type BookSlice = {
  book: LectureBook;
  /** PDF page ranges, e.g. "71-78,133-142". */
  pages: string;
  /** Book chapters covered, shown as the link's tooltip. */
  chapters: string;
};

export const LECTURE_BOOKS_BUCKET = "lecture-books";

const ENGLISH: LectureBook = {
  file: "লেকচার বুক - English Grammar & Literature.pdf",
  folder: "english",
  name: "English Grammar & Literature",
};

const slice = (book: LectureBook, pages: string, chapters: string): BookSlice => ({
  book,
  pages,
  chapters,
});

/** By lecture title, as in BCS_SYLLABUS. */
export const LECTURE_BOOK_SLICES: Readonly<Record<string, BookSlice>> = {
  "Lit 01: Literary Terms": slice(ENGLISH, "171-179", "Figure of Speech and Literary Terms"),
  "Lit 02: Old & Middle English Period & The Renaissance Period-1": slice(
    ENGLISH,
    "179-211",
    "Periods of English literature, Old and Middle English, the Renaissance",
  ),
  "Lit 03: The Renaissance Period-2": slice(
    ENGLISH,
    "183-211",
    "The Renaissance: Elizabethan, Jacobean, Caroline, Commonwealth",
  ),
  "Lit 04: The Renaissance Period-3": slice(
    ENGLISH,
    "183-211",
    "The Renaissance: Elizabethan, Jacobean, Caroline, Commonwealth",
  ),
  "Lit 05: The Neoclassical Period (1660-1798)": slice(
    ENGLISH,
    "210-220",
    "Neoclassical: Restoration, Augustan, Age of Sensibility",
  ),
  "Lit 06: The Romantic Period": slice(ENGLISH, "220-231", "The Romantic Period"),
  "Lit 07: The Victorian Period": slice(ENGLISH, "231-244", "The Victorian Period"),
  "Lit 08: Modern English Period": slice(ENGLISH, "244-253", "The Modern Period"),
  "Lit 09: Modern 2 + Post Modern Period": slice(
    ENGLISH,
    "253-268",
    "The Georgian Period, Post Modern Period",
  ),
  "Lit 10: Post Modern Period (1939 – Present)": slice(
    ENGLISH,
    "262-276",
    "Post Modern Period, Confusion, Quotations, writers of different countries",
  ),
  "Grammar 1.1: Basic & Gerund Participle (Part-1)": slice(
    ENGLISH,
    "5-18",
    "Basics of English Grammar",
  ),
  "Grammar 1.2: Basic & Gerund Participle (Part-2)": slice(
    ENGLISH,
    "5-18",
    "Basics of English Grammar",
  ),
  "Grammar 2: Identification of Phrases & Clauses": slice(ENGLISH, "17-22", "Phrase and Clause"),
  "Grammar 3: Determiner, Noun": slice(ENGLISH, "22-32", "Noun"),
  "Grammar 4: Pronoun, Number, Gender": slice(ENGLISH, "32-43", "Pronoun, Number, Gender"),
  "Grammar 5: Adjective & Adverb": slice(ENGLISH, "43-59", "Adjective, Adverb"),
  "Grammar 6: Preposition-1": slice(ENGLISH, "59-71", "Preposition"),
  "Grammar 7: Preposition-2": slice(ENGLISH, "59-71", "Preposition"),
  "Grammar 8: Tense": slice(ENGLISH, "78-87", "Tense"),
  "Grammar 9: Voice": slice(ENGLISH, "122-129", "Voice"),
  "Grammar 10: Conditionals": slice(ENGLISH, "115-122", "Conditional Sentence"),
  "Grammar 11: Verb & Right Form of Verb": slice(ENGLISH, "87-99", "Verb"),
  "Grammar 12: Correction": slice(ENGLISH, "147-156", "Correction"),
  "Grammar 13: Conjunction & Sentence": slice(
    ENGLISH,
    "71-78,133-142",
    "Conjunction, Sentence & Transformation",
  ),
  "Grammar 14: Narration": slice(ENGLISH, "129-133", "Narration"),
  "Grammar 15: Subject-Verb Agreement": slice(ENGLISH, "142-147", "Subject-Verb-Agreement"),
  "Grammar 16: Phrasal Verb": slice(ENGLISH, "99-103", "Phrasal Verb"),
  "Grammar 17: Spelling": slice(ENGLISH, "156-161", "Spelling"),
  "Grammar 18: Phrase & Idioms": slice(ENGLISH, "103-115", "Phrase and Idioms"),
  "Grammar 19: One Word Substitute": slice(ENGLISH, "161-171", "One-Word Substitution"),
};

/** The lecture's file name in the bucket: its title, lower-cased, as a slug. */
export function lectureSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Where a lecture's book pages live in the bucket, or null without a book. */
export function lectureBookPath(title: string): string | null {
  const s = LECTURE_BOOK_SLICES[title];
  return s ? `${s.book.folder}/${lectureSlug(title)}.pdf` : null;
}

/** The pages as a list of PDF page numbers (1-based), in order. */
export function slicePages(pages: string): number[] {
  return pages.split(",").flatMap((range) => {
    const [from, to = from] = range.split("-").map(Number);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
}
