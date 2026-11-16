"use client";

import { useActionState } from "react";
import { saveCheckIn } from "@/actions/habits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CheckInFormState } from "@/schemas/habit";

type CheckInPanelProps = {
  habitId: string;
  habitName: string;
  periodLabel: string;
  current: { count: number; minutes: number; note: string | null };
  onDone: () => void;
};

/** Edit the current period's count, minutes and note. */
export function CheckInPanel({
  habitId,
  habitName,
  periodLabel,
  current,
  onDone,
}: CheckInPanelProps) {
  const [state, formAction, pending] = useActionState(
    async (prev: CheckInFormState, formData: FormData) => {
      const result = await saveCheckIn(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    {},
  );
  const prefix = `log-${habitId}`;
  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      aria-label={`Log ${habitName} for ${periodLabel}`}
      className="grid gap-3 border-t border-border bg-surface-2/60 px-3 py-3 sm:grid-cols-[7rem_7rem_1fr_auto] sm:items-end sm:px-4"
    >
      <input type="hidden" name="habitId" value={habitId} />
      <Field id={`${prefix}-count`} label="Count" error={errors.count}>
        <Input
          id={`${prefix}-count`}
          name="count"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={current.count}
          invalid={Boolean(errors.count)}
        />
      </Field>
      <Field id={`${prefix}-minutes`} label="Minutes" error={errors.minutes}>
        <Input
          id={`${prefix}-minutes`}
          name="minutes"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={current.minutes}
          invalid={Boolean(errors.minutes)}
        />
      </Field>
      <Field id={`${prefix}-note`} label="Note" error={errors.note}>
        <Textarea
          id={`${prefix}-note`}
          name="note"
          rows={1}
          maxLength={500}
          defaultValue={current.note ?? ""}
          placeholder={`How did ${periodLabel} go?`}
          className="min-h-9 py-1.5"
          invalid={Boolean(errors.note)}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger sm:col-span-4">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
