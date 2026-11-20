import { BookOpen, ExternalLink } from "lucide-react";
import type { LecturePart } from "@/lib/workstation/bcs-syllabus";

/**
 * "Lecture ↗" for a one-video lecture, "Part 1 ↗ Part 2 ↗ …" for a merged one,
 * and "Book" when the lecture book has pages for it.
 */
export function LectureLinks({
  parts,
  topicId,
  book,
}: {
  parts: LecturePart[];
  topicId?: string;
  /** Chapters the book pages cover; no link when null. */
  book?: string | null;
}) {
  return (
    <>
      {parts.map((part, i) => (
        <a
          key={part.url}
          href={part.url}
          target="_blank"
          rel="noreferrer"
          title={part.title}
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          {parts.length === 1 ? "Lecture" : `Part ${i + 1}`}
          <span className="sr-only">: {part.title}</span>
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ))}
      {topicId && book ? (
        <a
          href={`/work-station/book/${topicId}`}
          target="_blank"
          rel="noreferrer"
          title={`Lecture book: ${book}`}
          className="inline-flex items-center gap-1 text-accent hover:underline"
          data-testid="ws-book"
        >
          <BookOpen className="size-3" aria-hidden />
          Book (PDF)
          <span className="sr-only">: {book}</span>
        </a>
      ) : null}
    </>
  );
}
