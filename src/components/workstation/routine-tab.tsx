"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { deleteSlot, resetRoutine, saveSlot } from "@/actions/workstation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { iconButton, plural } from "@/components/workstation/format";
import { cn } from "@/lib/utils";
import {
  KIND_LABEL,
  ROUTINE_KINDS,
  WEEKDAY_NAME,
  WEEK_ORDER,
  dayCycles,
  defaultRoutine,
  formatMinute,
  slotCycles,
  slotsForWeekday,
  weekCycles,
} from "@/lib/workstation/routine";
import type { WsSlot } from "@/lib/workstation/server";

/** The default routine's weekly study cycles (7 a day on office days, 15 on Friday). */
const TARGET = weekCycles(defaultRoutine());

export function RoutineTab({ slots }: { slots: WsSlot[] }) {
  const total = weekCycles(slots);
  const [editing, setEditing] = useState<string | null>(null); // slot id, or "new-<weekday>"
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="font-mono font-semibold tabular-nums" data-testid="ws-routine-total">
            {total}
          </span>{" "}
          study cycles a week{" "}
          <span className={cn("text-fg-muted", total !== TARGET && "text-warning")}>
            {total === TARGET ? `(target ${TARGET})` : `· target is ${TARGET}`}
          </span>
        </p>
        {confirmReset ? (
          <span className="flex items-center gap-2">
            <span className="text-sm text-fg-muted">
              Replace every slot with the default routine?
            </span>
            <Button
              size="sm"
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await resetRoutine();
                  setError(r.error ?? null);
                  setConfirmReset(false);
                })
              }
            >
              Reset
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setConfirmReset(true)}>
            Reset to default
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {WEEK_ORDER.map((weekday) => {
          const daySlots = slotsForWeekday(slots, weekday);
          return (
            <section
              key={weekday}
              aria-labelledby={`day-${weekday}`}
              className="rounded-lg border border-border bg-surface"
              data-testid="ws-routine-day"
            >
              <header className="flex min-h-11 items-center justify-between px-4 pt-3 pb-1.5 sm:px-5">
                <h2
                  id={`day-${weekday}`}
                  className="font-display text-base font-semibold tracking-tight"
                >
                  {WEEKDAY_NAME[weekday]}
                </h2>
                <span className="font-mono text-xs text-fg-muted tabular-nums">
                  {plural(dayCycles(slots, weekday), "cycle")}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {daySlots.map((slot) =>
                  editing === slot.id ? (
                    <li key={slot.id} className="p-3">
                      <SlotForm slot={slot} weekday={weekday} onDone={() => setEditing(null)} />
                    </li>
                  ) : (
                    <li key={slot.id} className="flex items-center gap-2 px-4 py-2">
                      <span className="w-24 shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                        {formatMinute(slot.startMin)}–{formatMinute(slot.endMin)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{slot.label}</span>
                        <span className="block text-xs text-fg-muted">
                          {slot.kind === "STUDY"
                            ? `Study · ${plural(slotCycles(slot), "cycle")}`
                            : KIND_LABEL[slot.kind]}
                        </span>
                      </span>
                      <button
                        type="button"
                        className={iconButton}
                        onClick={() => setEditing(slot.id)}
                        aria-label={`Edit ${slot.label} on ${WEEKDAY_NAME[weekday]}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={cn(iconButton, "hover:text-danger")}
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await deleteSlot(slot.id);
                            setError(r.error ?? null);
                          })
                        }
                        aria-label={`Delete ${slot.label} on ${WEEKDAY_NAME[weekday]}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  ),
                )}
                <li className="p-3">
                  {editing === `new-${weekday}` ? (
                    <SlotForm slot={null} weekday={weekday} onDone={() => setEditing(null)} />
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(`new-${weekday}`)}
                      aria-label={`Add slot on ${WEEKDAY_NAME[weekday]}`}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add slot
                    </Button>
                  )}
                </li>
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SlotForm({
  slot,
  weekday,
  onDone,
}: {
  slot: WsSlot | null;
  weekday: number;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveSlot.bind(null, slot?.id ?? null), {});
  const errors = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const id = slot?.id ?? `new-${weekday}`;
  const message =
    state.error ?? errors.start ?? errors.end ?? errors.label ?? errors.kind ?? errors.weekday;

  return (
    <form
      action={action}
      noValidate
      className="flex flex-col gap-2"
      aria-label={slot ? `Edit ${slot.label}` : `New slot on ${WEEKDAY_NAME[weekday]}`}
    >
      <input type="hidden" name="weekday" value={weekday} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          Start
          <Input
            name="start"
            type="time"
            defaultValue={slot ? formatMinute(slot.startMin) : "19:00"}
            invalid={Boolean(errors.start)}
            aria-describedby={message ? `${id}-error` : undefined}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          End
          <Input
            name="end"
            type="time"
            defaultValue={
              slot ? (slot.endMin >= 1440 ? "23:59" : formatMinute(slot.endMin)) : "20:00"
            }
            invalid={Boolean(errors.end)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          Label
          <Input
            name="label"
            defaultValue={slot?.label ?? "Study"}
            maxLength={60}
            invalid={Boolean(errors.label)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          Type
          <Select name="kind" defaultValue={slot?.kind ?? "STUDY"}>
            {ROUTINE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {message ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Save slot
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
