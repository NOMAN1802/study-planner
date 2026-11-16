"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { PALETTE_MIME, blockColor, dayKeyLabel, timeFormatter } from "@/components/planner/format";
import {
  MINUTE_MS,
  blockAt,
  layoutLanes,
  moveBlock,
  moveToDay,
  resizeBlock,
  segmentInDay,
  snapMinutes,
  type DayInfo,
  type Span,
} from "@/lib/planner";
import type { PaletteItem, PlannerBlock } from "@/lib/planner-server";
import { useMounted } from "@/lib/use-mounted";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

export const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;
const SLOT_MINUTES = 30;

type DragState = {
  id: string;
  mode: "move" | "resize";
  originX: number;
  originY: number;
  original: Span;
  originDay: number;
  moved: boolean;
};

export type GridHandlers = {
  onCreate: (item: PaletteItem, span: Span) => void;
  onUpdate: (id: string, span: Span) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  findItem: (raw: string) => PaletteItem | undefined;
};

type TimeGridProps = GridHandlers & {
  days: DayInfo[];
  blocks: PlannerBlock[];
  conflicts: Set<string>;
  timezone: string;
  today: string;
  armed: PaletteItem | null;
  selectedId: string | null;
  onPlaced: () => void;
};

export function TimeGrid(props: TimeGridProps) {
  const { days, blocks, conflicts, timezone, today, armed, selectedId } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<{ id: string; span: Span } | null>(null);
  const [dropHint, setDropHint] = useState<{ day: number; minutes: number } | null>(null);
  const mounted = useMounted();
  const now = useNow(60_000);
  const time = timeFormatter(timezone);
  const multi = days.length > 1;

  // Start the view at 07:00 rather than midnight.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX - 8;
  }, []);

  const shown = blocks.map((b) => (preview && preview.id === b.id ? { ...b, ...preview.span } : b));

  function columnAt(clientX: number): number | null {
    const idx = columnRefs.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return clientX >= r.left && clientX < r.right;
    });
    return idx === -1 ? null : idx;
  }

  function pointerDown(
    e: PointerEvent<HTMLElement>,
    block: PlannerBlock,
    dayIndex: number,
    mode: DragState["mode"],
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      id: block.id,
      mode,
      originX: e.clientX,
      originY: e.clientY,
      original: { start: block.start, end: block.end },
      originDay: dayIndex,
      moved: false,
    };
  }

  function pointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.originX;
    const dy = e.clientY - d.originY;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    d.moved = true;
    const deltaMin = dy / PX_PER_MIN;
    let span =
      d.mode === "resize" ? resizeBlock(d.original, deltaMin) : moveBlock(d.original, deltaMin);
    if (d.mode === "move" && multi) {
      const col = columnAt(e.clientX);
      if (col !== null && col !== d.originDay)
        span = moveToDay(span, days[d.originDay].start, days[col].start);
    }
    setPreview({ id: d.id, span });
  }

  function pointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      props.onSelect(d.id);
      setPreview(null);
      return;
    }
    if (
      preview &&
      preview.id === d.id &&
      (preview.span.start !== d.original.start || preview.span.end !== d.original.end)
    ) {
      props.onUpdate(d.id, preview.span);
    }
    setPreview(null);
  }

  function blockKey(e: KeyboardEvent<HTMLElement>, block: PlannerBlock, dayIndex: number) {
    const span = { start: block.start, end: block.end };
    let next: Span | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const delta = e.key === "ArrowUp" ? -15 : 15;
      next = e.shiftKey ? resizeBlock(span, delta) : moveBlock(span, delta);
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && multi) {
      const target = dayIndex + (e.key === "ArrowLeft" ? -1 : 1);
      if (days[target]) next = moveToDay(span, days[dayIndex].start, days[target].start);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      props.onDelete(block.id);
      return;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onSelect(block.id);
      return;
    }
    if (next) {
      e.preventDefault();
      props.onUpdate(block.id, next);
    }
  }

  function minutesAt(e: DragEvent<HTMLElement>, dayIndex: number): number {
    const el = columnRefs.current[dayIndex];
    if (!el) return 0;
    return snapMinutes((e.clientY - el.getBoundingClientRect().top) / PX_PER_MIN);
  }

  function dragOver(e: DragEvent<HTMLDivElement>, dayIndex: number) {
    if (!e.dataTransfer.types.includes(PALETTE_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const minutes = minutesAt(e, dayIndex);
    if (!dropHint || dropHint.day !== dayIndex || dropHint.minutes !== minutes)
      setDropHint({ day: dayIndex, minutes });
  }

  function drop(e: DragEvent<HTMLDivElement>, dayIndex: number) {
    setDropHint(null);
    const raw = e.dataTransfer.getData(PALETTE_MIME);
    const item = raw ? props.findItem(raw) : undefined;
    if (!item) return;
    e.preventDefault();
    props.onCreate(item, blockAt(days[dayIndex], minutesAt(e, dayIndex), item.defaultMinutes));
  }

  const gutterHours = days[0].hours;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <div className={cn(multi ? "min-w-[44rem]" : "min-w-0")}>
        {/* Day headers */}
        <div className="flex border-b border-border">
          <div className="w-14 shrink-0" aria-hidden />
          {days.map((day) => (
            <div
              key={day.key}
              className="min-w-0 flex-1 border-l border-border px-2 py-2 text-center"
            >
              {multi ? (
                <Link
                  href={`/planner?view=day&date=${day.key}`}
                  className={cn(
                    "inline-flex items-center rounded px-1.5 text-xs font-medium transition-colors duration-150 hover:bg-surface-2",
                    day.key === today
                      ? "bg-accent text-accent-fg hover:bg-accent-strong"
                      : "text-fg-muted",
                  )}
                >
                  {dayKeyLabel(day.key, "weekday")}
                </Link>
              ) : (
                <span className="text-xs font-medium text-fg-muted">
                  {dayKeyLabel(day.key, "short")}
                </span>
              )}
            </div>
          ))}
        </div>

        <div
          ref={scrollRef}
          className="relative max-h-[calc(100dvh-15rem)] min-h-96 overflow-y-auto"
          role="region"
          aria-label="Schedule grid"
          tabIndex={0}
          data-testid="planner-scroll"
        >
          <div className="flex">
            {/* Hour gutter */}
            <div
              className="relative w-14 shrink-0"
              style={{ height: ((days[0].end - days[0].start) / MINUTE_MS) * PX_PER_MIN }}
            >
              {gutterHours.map((h, i) =>
                i === 0 ? null : (
                  <span
                    key={h}
                    className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-fg-subtle tabular-nums"
                    style={{ top: ((h - days[0].start) / MINUTE_MS) * PX_PER_MIN }}
                  >
                    {time(h)}
                  </span>
                ),
              )}
            </div>

            {days.map((day, dayIndex) => {
              const height = ((day.end - day.start) / MINUTE_MS) * PX_PER_MIN;
              const inDay = shown.filter((b) => segmentInDay(b, day));
              const lanes = layoutLanes(inDay);
              const isToday = day.key === today;
              return (
                <div
                  key={day.key}
                  ref={(el) => {
                    columnRefs.current[dayIndex] = el;
                  }}
                  className={cn(
                    "relative min-w-0 flex-1 border-l border-border",
                    isToday && multi && "bg-accent-soft/30",
                  )}
                  style={{ height }}
                  data-testid={`day-column-${day.key}`}
                  aria-label={dayKeyLabel(day.key, "long")}
                  role="group"
                  onDragOver={(e) => dragOver(e, dayIndex)}
                  onDragLeave={() => setDropHint(null)}
                  onDrop={(e) => drop(e, dayIndex)}
                >
                  {day.hours.map((h, i) => (
                    <div
                      key={h}
                      className={cn(
                        "absolute inset-x-0 border-t",
                        i === 0 ? "border-transparent" : "border-border",
                      )}
                      style={{ top: ((h - day.start) / MINUTE_MS) * PX_PER_MIN }}
                      aria-hidden
                    />
                  ))}

                  {dropHint && dropHint.day === dayIndex ? (
                    <div
                      className="pointer-events-none absolute inset-x-1 h-0.5 rounded bg-accent"
                      style={{ top: dropHint.minutes * PX_PER_MIN }}
                      aria-hidden
                    />
                  ) : null}

                  {mounted && isToday && now >= day.start && now < day.end ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger"
                      style={{ top: ((now - day.start) / MINUTE_MS) * PX_PER_MIN }}
                      aria-hidden
                    />
                  ) : null}

                  {inDay.map((block) => {
                    const seg = segmentInDay(block, day);
                    if (!seg) return null;
                    const lane = lanes.get(block.id) ?? { lane: 0, lanes: 1 };
                    const conflict = conflicts.has(block.id);
                    const color = blockColor(block.color);
                    const label = `${block.title}, ${time(block.start)}–${time(block.end)}${conflict ? ", overlaps another block" : ""}`;
                    const tall = seg.height >= 45;
                    return (
                      <div
                        key={block.id}
                        role="button"
                        tabIndex={0}
                        aria-label={label}
                        title={label}
                        aria-pressed={selectedId === block.id}
                        data-testid="planner-block"
                        data-block-id={block.id}
                        onPointerDown={(e) => pointerDown(e, block, dayIndex, "move")}
                        onPointerMove={pointerMove}
                        onPointerUp={pointerUp}
                        onPointerCancel={() => {
                          drag.current = null;
                          setPreview(null);
                        }}
                        onKeyDown={(e) => blockKey(e, block, dayIndex)}
                        className={cn(
                          "absolute z-10 cursor-grab touch-none overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight text-fg shadow-sm transition-[box-shadow] duration-150 select-none active:cursor-grabbing",
                          selectedId === block.id && "ring-2 ring-fg/60",
                          conflict && "outline-1 outline-danger outline-dashed",
                          preview?.id === block.id && "z-30 opacity-90 shadow-md",
                          block.done && "opacity-60",
                        )}
                        style={{
                          top: seg.top * PX_PER_MIN,
                          height: Math.max(seg.height * PX_PER_MIN - 1, 10),
                          left: `calc(${(lane.lane / lane.lanes) * 100}% + 2px)`,
                          width: `calc(${100 / lane.lanes}% - 4px)`,
                          borderLeftColor: color,
                          background: `color-mix(in srgb, ${color} 18%, var(--surface))`,
                        }}
                      >
                        <div className="flex items-start gap-1">
                          {conflict ? (
                            <AlertTriangle
                              className="mt-px size-3 shrink-0 text-danger"
                              aria-hidden
                            />
                          ) : null}
                          <span
                            className={cn("truncate font-medium", block.done && "line-through")}
                          >
                            {block.title}
                          </span>
                        </div>
                        {tall ? (
                          <div
                            className="font-mono text-[10px] text-fg-muted tabular-nums"
                            aria-hidden
                          >
                            {time(block.start)}–{time(block.end)}
                          </div>
                        ) : null}
                        <div
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                          data-testid="resize-handle"
                          aria-hidden
                          onPointerDown={(e) => pointerDown(e, block, dayIndex, "resize")}
                          onPointerMove={pointerMove}
                          onPointerUp={pointerUp}
                        />
                      </div>
                    );
                  })}

                  {armed
                    ? Array.from(
                        { length: Math.floor((day.end - day.start) / MINUTE_MS / SLOT_MINUTES) },
                        (_, i) => {
                          const minutes = i * SLOT_MINUTES;
                          const span = blockAt(day, minutes, armed.defaultMinutes);
                          return (
                            <button
                              key={minutes}
                              type="button"
                              className="absolute inset-x-0 z-20 border border-transparent hover:border-dashed hover:border-accent hover:bg-accent-soft/60 focus-visible:bg-accent-soft/60"
                              style={{
                                top: minutes * PX_PER_MIN,
                                height: SLOT_MINUTES * PX_PER_MIN,
                              }}
                              aria-label={`Place ${armed.title} at ${multi ? `${dayKeyLabel(day.key, "short")} ` : ""}${time(span.start)}`}
                              onClick={() => {
                                props.onCreate(armed, span);
                                props.onPlaced();
                              }}
                            />
                          );
                        },
                      )
                    : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
