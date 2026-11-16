"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useState, type DragEvent, type KeyboardEvent } from "react";
import {
  BLOCK_MIME,
  PALETTE_MIME,
  blockColor,
  dayKeyLabel,
  timeFormatter,
} from "@/components/planner/format";
import type { GridHandlers } from "@/components/planner/time-grid";
import { blockAt, moveToDay, overlaps, type DayInfo } from "@/lib/planner";
import type { PaletteItem, PlannerBlock } from "@/lib/planner-server";
import { WEEKDAYS } from "@/lib/habit-options";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 3;
/** Items dropped on a month cell start at 09:00 local. */
const DEFAULT_START_MINUTES = 9 * 60;

type MonthGridProps = GridHandlers & {
  days: DayInfo[];
  month: string; // "YYYY-MM"
  blocks: PlannerBlock[];
  conflicts: Set<string>;
  timezone: string;
  today: string;
  armed: PaletteItem | null;
  selectedId: string | null;
  onPlaced: () => void;
};

export function MonthGrid(props: MonthGridProps) {
  const { days, month, blocks, conflicts, timezone, today, armed, selectedId } = props;
  const [over, setOver] = useState<number | null>(null);
  const time = timeFormatter(timezone);
  const firstWeekday = Number(new Date(`${days[0].key}T00:00:00Z`).getUTCDay());
  const headers = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(firstWeekday + i) % 7].slice(0, 3));

  function dragOver(e: DragEvent<HTMLDivElement>, i: number) {
    const types = e.dataTransfer.types;
    if (!types.includes(PALETTE_MIME) && !types.includes(BLOCK_MIME)) return;
    e.preventDefault();
    if (over !== i) setOver(i);
  }

  function drop(e: DragEvent<HTMLDivElement>, i: number) {
    setOver(null);
    const day = days[i];
    const item = e.dataTransfer.getData(PALETTE_MIME);
    if (item) {
      const found = props.findItem(item);
      if (found) {
        e.preventDefault();
        props.onCreate(found, blockAt(day, DEFAULT_START_MINUTES, found.defaultMinutes));
      }
      return;
    }
    const raw = e.dataTransfer.getData(BLOCK_MIME);
    if (!raw) return;
    e.preventDefault();
    const { id, fromDay } = JSON.parse(raw) as { id: string; fromDay: number };
    const block = blocks.find((b) => b.id === id);
    if (block && days[fromDay] && fromDay !== i) {
      props.onUpdate(id, moveToDay(block, days[fromDay].start, day.start));
    }
  }

  function chipKey(e: KeyboardEvent<HTMLElement>, block: PlannerBlock, i: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onSelect(block.id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      props.onDelete(block.id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const target = i + (e.key === "ArrowLeft" ? -1 : 1);
      if (days[target]) {
        e.preventDefault();
        props.onUpdate(block.id, moveToDay(block, days[i].start, days[target].start));
      }
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border">
        {headers.map((h) => (
          <div key={h} className="px-2 py-2 text-center text-xs font-medium text-fg-muted">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.key.startsWith(month);
          const items = blocks.filter((b) => overlaps(b, day)).sort((a, b) => a.start - b.start);
          const hidden = items.length - MAX_CHIPS;
          return (
            <div
              key={day.key}
              role="group"
              aria-label={dayKeyLabel(day.key, "long")}
              data-testid={`month-cell-${day.key}`}
              onDragOver={(e) => dragOver(e, i)}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => drop(e, i)}
              className={cn(
                "relative flex min-h-24 min-w-0 flex-col gap-0.5 border-b border-l border-border p-1 sm:min-h-28",
                i % 7 === 0 && "border-l-0",
                !inMonth && "bg-surface-2/50",
                over === i && "bg-accent-soft",
              )}
            >
              <Link
                href={`/planner?view=day&date=${day.key}`}
                className={cn(
                  "mb-0.5 inline-flex size-6 items-center justify-center self-start rounded-full text-xs tabular-nums transition-colors duration-150 hover:bg-surface-3",
                  day.key === today
                    ? "bg-accent font-medium text-accent-fg hover:bg-accent-strong"
                    : inMonth
                      ? "text-fg"
                      : "text-fg-subtle",
                )}
                aria-label={`Open ${dayKeyLabel(day.key, "long")}`}
              >
                {Number(day.key.slice(8))}
              </Link>
              {items.slice(0, MAX_CHIPS).map((block) => {
                const conflict = conflicts.has(block.id);
                return (
                  <div
                    key={block.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    data-testid="planner-block"
                    data-block-id={block.id}
                    aria-pressed={selectedId === block.id}
                    aria-label={`${block.title}, ${time(block.start)}–${time(block.end)}${conflict ? ", overlaps another block" : ""}`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        BLOCK_MIME,
                        JSON.stringify({ id: block.id, fromDay: i }),
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => props.onSelect(block.id)}
                    onKeyDown={(e) => chipKey(e, block, i)}
                    className={cn(
                      "flex min-w-0 cursor-grab items-center gap-1 rounded border-l-2 px-1 py-px text-[11px] leading-tight text-fg",
                      selectedId === block.id && "ring-2 ring-fg/60",
                      block.done && "opacity-60",
                    )}
                    style={{
                      borderLeftColor: blockColor(block.color),
                      background: `color-mix(in srgb, ${blockColor(block.color)} 16%, var(--surface))`,
                    }}
                  >
                    {conflict ? (
                      <AlertTriangle className="size-3 shrink-0 text-danger" aria-hidden />
                    ) : null}
                    <span
                      className="hidden shrink-0 font-mono text-[10px] text-fg-muted tabular-nums sm:inline"
                      aria-hidden
                    >
                      {time(block.start)}
                    </span>
                    <span className={cn("truncate", block.done && "line-through")}>
                      {block.title}
                    </span>
                  </div>
                );
              })}
              {hidden > 0 ? (
                <Link
                  href={`/planner?view=day&date=${day.key}`}
                  className="px-1 text-[11px] text-fg-muted hover:text-fg"
                >
                  +{hidden} more
                </Link>
              ) : null}
              {armed ? (
                <button
                  type="button"
                  className="absolute inset-0 z-10 rounded-none border border-transparent hover:border-dashed hover:border-accent hover:bg-accent-soft/60 focus-visible:bg-accent-soft/60"
                  aria-label={`Place ${armed.title} on ${dayKeyLabel(day.key, "short")}`}
                  onClick={() => {
                    props.onCreate(
                      armed,
                      blockAt(day, DEFAULT_START_MINUTES, armed.defaultMinutes),
                    );
                    props.onPlaced();
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
