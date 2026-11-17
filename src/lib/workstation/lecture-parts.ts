import type { LecturePart } from "@/lib/workstation/bcs-syllabus";

/**
 * A lecture's video links from its stored `parts` JSON, falling back to the
 * single `url` of rows created before lectures were merged.
 */
export function lectureParts(parts: unknown, url: string | null): LecturePart[] {
  if (Array.isArray(parts)) {
    const valid = parts.filter(
      (p): p is LecturePart =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as LecturePart).title === "string" &&
        typeof (p as LecturePart).url === "string" &&
        /^https:\/\//.test((p as LecturePart).url),
    );
    if (valid.length > 0) return valid.map(({ title, url }) => ({ title, url }));
  }
  return url ? [{ title: "Lecture", url }] : [];
}
