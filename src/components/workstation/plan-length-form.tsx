"use client";

import { X } from "lucide-react";
import { useActionState, useState } from "react";
import { formatDay } from "@/components/workstation/format";
import { updatePlanLength } from "@/actions/workstation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function PlanLengthForm({
  startDay,
  learningDays,
  revisionDays,
  holidays: initialHolidays,
}: {
  startDay: string;
  learningDays: number;
  revisionDays: number;
  holidays: string[];
}) {
  const [state, action, pending] = useActionState(updatePlanLength, {});
  const errors = state.fieldErrors ?? {};
  const [holidays, setHolidays] = useState(initialHolidays);
  const [draft, setDraft] = useState("");
  function addHoliday() {
    if (!draft) return;
    setHolidays((h) => [...new Set([...h, draft])].sort());
    setDraft("");
  }
  return (
    <form
      action={action}
      noValidate
      aria-label="Plan settings"
      className="flex flex-wrap items-end gap-3"
    >
      <Field id="plan-startDay" label="First study day" error={errors.startDay}>
        <Input
          id="plan-startDay"
          name="startDay"
          type="date"
          defaultValue={startDay}
          invalid={Boolean(errors.startDay)}
          className="w-44"
        />
      </Field>
      <Field id="plan-learningDays" label="Learning days" error={errors.learningDays}>
        <Input
          id="plan-learningDays"
          name="learningDays"
          type="number"
          inputMode="numeric"
          min={7}
          defaultValue={learningDays}
          invalid={Boolean(errors.learningDays)}
          className="w-28"
        />
      </Field>
      <Field id="plan-revisionDays" label="Revision days" error={errors.revisionDays}>
        <Input
          id="plan-revisionDays"
          name="revisionDays"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={revisionDays}
          invalid={Boolean(errors.revisionDays)}
          className="w-28"
        />
      </Field>
      <div className="flex w-full flex-col gap-2">
        <Field
          id="plan-holiday"
          label="Holidays"
          error={errors.holidays}
          hint="Govt holidays are studied like a Friday: 3 lectures, then revision."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="plan-holiday"
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHoliday();
                }
              }}
              invalid={Boolean(errors.holidays)}
              className="w-44"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addHoliday}>
              Add holiday
            </Button>
          </div>
        </Field>
        <input type="hidden" name="holidays" value={holidays.join(",")} />
        {holidays.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Holiday list">
            {holidays.map((d) => (
              <li
                key={d}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 py-0.5 pr-0.5 pl-2 text-xs"
              >
                <span className="font-mono tabular-nums">{formatDay(d)}</span>
                <button
                  type="button"
                  onClick={() => setHolidays((h) => h.filter((x) => x !== d))}
                  className="inline-flex size-6 items-center justify-center rounded text-fg-muted hover:bg-surface hover:text-fg"
                  aria-label={`Remove holiday ${formatDay(d)}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Save plan
      </Button>
      <p role="status" className="text-sm text-fg-muted">
        {state.error ?? (state.ok && !pending ? "Plan saved." : "")}
      </p>
    </form>
  );
}
