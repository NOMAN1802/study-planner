"use client";

import { AlertTriangle, CalendarPlus, GripVertical, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createTimeBlock, deleteTimeBlock, updateTimeBlock } from "@/actions/planner";
import { PALETTE_MIME, blockColor, dayKeyLabel, timeFormatter } from "@/components/planner/format";
import { MonthGrid } from "@/components/planner/month-grid";
import { TimeGrid } from "@/components/planner/time-grid";
import { conflictingIds, dayKeyOf, type DayInfo, type PlannerView, type Span } from "@/lib/planner";
import type { PaletteItem, PlannerBlock } from "@/lib/planner-server";
import { cn } from "@/lib/utils";

type PlannerBoardProps = {
  view: PlannerView;
  date: string;
  days: DayInfo[];
  blocks: PlannerBlock[];
  palette: PaletteItem[];
  timezone: string;
  today: string;
};

const itemKey = (item: Pick<PaletteItem, "kind" | "id">) =>
  JSON.stringify({ kind: item.kind, id: item.id });
let tempCounter = 0;

export function PlannerBoard({
  view,
  date,
  days,
  blocks: serverBlocks,
  palette,
  timezone,
  today,
}: PlannerBoardProps) {
  const [blocks, setBlocks] = useState(serverBlocks);
  const [source, setSource] = useState(serverBlocks);
  const [armed, setArmed] = useState<PaletteItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const time = timeFormatter(timezone);

  // Fresh server data (after navigation or revalidation) replaces local state.
  if (source !== serverBlocks) {
    setSource(serverBlocks);
    setBlocks(serverBlocks);
  }

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmed(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [armed]);

  const conflicts = conflictingIds(blocks);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const findItem = (raw: string) => {
    try {
      const { kind, id } = JSON.parse(raw) as { kind: string; id: string };
      return palette.find((p) => p.kind === kind && p.id === id);
    } catch {
      return undefined;
    }
  };

  function create(item: PaletteItem, span: Span) {
    const tempId = `temp-${++tempCounter}`;
    const optimistic: PlannerBlock = {
      id: tempId,
      ...span,
      kind: item.kind,
      refId: item.id,
      title: item.title,
      color: item.color,
      done: false,
    };
    setBlocks((bs) => [...bs, optimistic]);
    setError(null);
    startTransition(async () => {
      const result = await createTimeBlock({ kind: item.kind, refId: item.id, ...span });
      setBlocks((bs) =>
        result.block
          ? bs.map((b) => (b.id === tempId ? (result.block as PlannerBlock) : b))
          : bs.filter((b) => b.id !== tempId),
      );
      if (result.error) setError(result.error);
    });
  }

  function update(id: string, span: Span) {
    if (id.startsWith("temp-")) return; // still saving
    const previous = blocks.find((b) => b.id === id);
    if (!previous) return;
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...span } : b)));
    setError(null);
    startTransition(async () => {
      const result = await updateTimeBlock(id, span);
      if (result.error) {
        setBlocks((bs) => bs.map((b) => (b.id === id ? previous : b)));
        setError(result.error);
      }
    });
  }

  function remove(id: string) {
    if (id.startsWith("temp-")) return;
    const previous = blocks;
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    setError(null);
    startTransition(async () => {
      const result = await deleteTimeBlock(id);
      if (result.error) {
        setBlocks(previous);
        setError(result.error);
      }
    });
  }

  const handlers = {
    onCreate: create,
    onUpdate: update,
    onDelete: remove,
    onSelect: setSelectedId,
    findItem,
    onPlaced: () => setArmed(null),
  };

  const tasks = palette.filter((p) => p.kind === "task");
  const habits = palette.filter((p) => p.kind === "habit");

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
      <aside className="flex flex-col gap-3 lg:order-none" aria-label="Schedule items">
        <section className="rounded-lg border border-border bg-surface">
          <h3 className="border-b border-border px-3 py-2 text-xs font-medium text-fg-muted">
            Drag onto the planner, or pick one and choose a slot
          </h3>
          <div className="max-h-56 overflow-y-auto lg:max-h-[calc(100dvh-22rem)]">
            <PaletteSection
              title="Tasks"
              items={tasks}
              armed={armed}
              onArm={setArmed}
              empty={
                <Link href="/tasks/new" className="text-accent hover:underline">
                  Create a task
                </Link>
              }
            />
            <PaletteSection
              title="Habits"
              items={habits}
              armed={armed}
              onArm={setArmed}
              empty={
                <Link href="/habits/new" className="text-accent hover:underline">
                  Create a habit
                </Link>
              }
            />
          </div>
        </section>

        {selected ? (
          <section
            className="rounded-lg border border-border bg-surface p-3"
            aria-labelledby="block-details"
            data-testid="block-details"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 id="block-details" className="text-sm font-medium text-fg">
                {selected.title}
              </h3>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded text-fg-muted hover:bg-surface-2"
                aria-label="Close details"
                onClick={() => setSelectedId(null)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            <p className="mt-1 font-mono text-xs text-fg-muted tabular-nums">
              {dayKeyLabel(dayKeyOf(selected.start, timezone))} · {time(selected.start)}–
              {time(selected.end)}
            </p>
            {conflicts.has(selected.id) ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-danger">
                <AlertTriangle className="size-3" aria-hidden />
                Overlaps another block
              </p>
            ) : null}
            <p className="mt-2 text-xs text-fg-subtle">
              Drag to move, drag the bottom edge to resize. With the block focused: arrows move it,
              Shift+arrows resize, Delete removes.
            </p>
            <div className="mt-3 flex items-center gap-2">
              {selected.kind === "task" && selected.refId ? (
                <Link
                  href={`/tasks/${selected.refId}/focus`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Open focus timer
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => remove(selected.id)}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-danger hover:bg-danger-soft"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete block
              </button>
            </div>
          </section>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-col gap-2">
        {armed ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-fg"
          >
            <CalendarPlus className="size-4 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              Choose a {view === "month" ? "day" : "slot"} for{" "}
              <strong className="font-medium">{armed.title}</strong> ({armed.defaultMinutes} min)
            </span>
            <button
              type="button"
              onClick={() => setArmed(null)}
              className="text-xs text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        {view === "month" ? (
          <MonthGrid
            {...handlers}
            days={days}
            month={date.slice(0, 7)}
            blocks={blocks}
            conflicts={conflicts}
            timezone={timezone}
            today={today}
            armed={armed}
            selectedId={selectedId}
          />
        ) : (
          <TimeGrid
            {...handlers}
            days={days}
            blocks={blocks}
            conflicts={conflicts}
            timezone={timezone}
            today={today}
            armed={armed}
            selectedId={selectedId}
          />
        )}
        {blocks.length === 0 ? (
          <p className="text-xs text-fg-subtle" role="status">
            Nothing planned in this {view}. Drag a task or habit from the list to block out time.
          </p>
        ) : (
          <p className="text-xs text-fg-subtle" role="status">
            {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
            {conflicts.size ? ` · ${conflicts.size} overlapping` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function PaletteSection({
  title,
  items,
  armed,
  onArm,
  empty,
}: {
  title: string;
  items: PaletteItem[];
  armed: PaletteItem | null;
  onArm: (item: PaletteItem | null) => void;
  empty: React.ReactNode;
}) {
  return (
    <div className="px-1.5 py-1.5">
      <h4 className="px-1.5 pb-1 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="px-1.5 pb-1 text-xs text-fg-muted">None yet. {empty}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const isArmed = armed?.kind === item.kind && armed.id === item.id;
            return (
              <li
                key={`${item.kind}-${item.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(PALETTE_MIME, itemKey(item));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                data-testid="palette-item"
                className={cn(
                  "group flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing",
                  isArmed && "bg-accent-soft",
                )}
              >
                <GripVertical className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: blockColor(item.color) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-fg">{item.title}</span>
                  {item.detail ? (
                    <span className="block truncate text-[11px] text-fg-subtle">{item.detail}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  aria-pressed={isArmed}
                  title="Pick a slot"
                  onClick={() => onArm(isArmed ? null : item)}
                  className="inline-flex h-6 shrink-0 items-center rounded px-1.5 font-mono text-[11px] text-fg-muted tabular-nums ring-accent hover:bg-surface-3 hover:text-fg aria-pressed:bg-accent aria-pressed:text-accent-fg"
                >
                  <span className="sr-only">Schedule {item.title}, </span>
                  {item.defaultMinutes}m
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
