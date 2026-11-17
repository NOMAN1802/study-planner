"use client";

import { useActionState } from "react";
import { updatePlanLength } from "@/actions/workstation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function PlanLengthForm({
  learningDays,
  revisionDays,
}: {
  learningDays: number;
  revisionDays: number;
}) {
  const [state, action, pending] = useActionState(updatePlanLength, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form
      action={action}
      noValidate
      aria-label="Plan length"
      className="flex flex-wrap items-end gap-3"
    >
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
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Save plan length
      </Button>
      <p role="status" className="text-sm text-fg-muted">
        {state.error ?? (state.ok && !pending ? "Plan length saved." : "")}
      </p>
    </form>
  );
}
