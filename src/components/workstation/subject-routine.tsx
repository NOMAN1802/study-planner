import { KIND_TEXT, formatDay, isExam, plural } from "@/components/workstation/format";
import { cn } from "@/lib/utils";
import type { SubjectRoutineDay } from "@/lib/workstation/schedule";

/** One subject's day-by-day plan: which lectures, revision and exams land on which date. */
export function SubjectRoutine({
  name,
  color,
  routine,
}: {
  name: string;
  color: string;
  routine: SubjectRoutineDay[];
}) {
  // Everything up to the subject's final exam (lectures, the revision after them and the
  // final day), then the revision blocks it gets once all subjects are learned.
  const cutoff = routine.findLast((d) => d.items.some((i) => i.kind !== "revision"))?.day;
  const learning = cutoff ? routine.filter((d) => d.day <= cutoff) : [];
  const revision = cutoff ? routine.filter((d) => d.day > cutoff) : routine;
  const first = learning[0]?.day;
  const lastLearning = learning.at(-1)?.day;

  return (
    <details className="group/routine border-t border-border" data-testid="ws-subject-routine">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium">
          Day-by-day routine
          <span className="ml-2 text-fg-muted group-open/routine:hidden">— show</span>
        </span>
        <span className="font-mono text-xs text-fg-muted tabular-nums">
          {first && lastLearning
            ? `${formatDay(first)} → ${formatDay(lastLearning)} · ${plural(learning.length, "day")}`
            : learning.length === 0 && revision.length > 0
              ? "Learning done"
              : "Nothing left to plan"}
        </span>
      </summary>

      {routine.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-fg-muted">
          Every lecture and the final exam of {name} are done.
        </p>
      ) : (
        <div className="px-4 pb-3">
          <p className="mb-2 text-xs text-fg-muted">
            Projected from today using your routine; finished lectures are left out and missed days
            push the dates later.
          </p>
          {learning.length > 0 ? <RoutineList days={learning} color={color} /> : null}
          {revision.length > 0 ? (
            <>
              <h4 className="mt-4 mb-2 text-xs font-medium text-fg-muted">
                Revision blocks · {plural(revision.length, "day")}
              </h4>
              <RoutineList days={revision} color={color} />
            </>
          ) : null}
        </div>
      )}
    </details>
  );
}

function RoutineList({ days, color }: { days: SubjectRoutineDay[]; color: string }) {
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-sm border border-border">
      {days.map((d) => (
        <li
          key={d.day}
          className="grid grid-cols-[6.5rem_1fr] gap-x-3 px-3 py-2 sm:grid-cols-[8rem_1fr]"
          data-testid="ws-subject-routine-day"
        >
          <div className="text-xs">
            <p className="font-medium text-fg">{formatDay(d.day)}</p>
            <p className="font-mono text-fg-muted tabular-nums">
              Day {d.index}
              {d.phase === "overflow" ? " · late" : ""}
            </p>
          </div>
          <ul className="flex min-w-0 flex-col gap-1">
            {d.items.map((item, i) => (
              <li
                key={`${item.kind}-${item.topicId ?? i}`}
                className="flex items-start gap-2 text-sm"
              >
                <span
                  className={cn(
                    "mt-2 size-1.5 shrink-0 rounded-full",
                    isExam(item.kind) && "ring-2 ring-mark",
                  )}
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  {item.kind === "topic" ? (
                    item.label
                  ) : (
                    <span className={cn("font-medium", isExam(item.kind) && "text-fg")}>
                      {KIND_TEXT[item.kind]}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                  {plural(item.cycles, "cycle")}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
