import { ExternalLink } from "lucide-react";
import type { LecturePart } from "@/lib/workstation/bcs-syllabus";

/** "Lecture ↗" for a one-video lecture, "Part 1 ↗ Part 2 ↗ …" for a merged one. */
export function LectureLinks({ parts }: { parts: LecturePart[] }) {
  if (parts.length === 0) return null;
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
    </>
  );
}
