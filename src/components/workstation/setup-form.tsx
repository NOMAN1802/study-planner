"use client";

import { useActionState } from "react";
import { setupPlan } from "@/actions/workstation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SetupForm({ defaultStart }: { defaultStart: string }) {
  const [state, action, pending] = useActionState(setupPlan, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-5" aria-label="Set up study plan">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="startDay" label="First study day" error={errors.startDay}>
          <Input
            id="startDay"
            name="startDay"
            type="date"
            defaultValue={defaultStart}
            invalid={Boolean(errors.startDay)}
          />
        </Field>
        <Field
          id="learningDays"
          label="Learning days"
          error={errors.learningDays}
          hint="Subjects one by one."
        >
          <Input
            id="learningDays"
            name="learningDays"
            type="number"
            inputMode="numeric"
            min={7}
            defaultValue={80}
            invalid={Boolean(errors.learningDays)}
            aria-describedby={errors.learningDays ? "learningDays-error" : "learningDays-hint"}
          />
        </Field>
        <Field
          id="revisionDays"
          label="Revision days"
          error={errors.revisionDays}
          hint="Revision and mock tests."
        >
          <Input
            id="revisionDays"
            name="revisionDays"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={20}
            invalid={Boolean(errors.revisionDays)}
            aria-describedby={errors.revisionDays ? "revisionDays-error" : "revisionDays-hint"}
          />
        </Field>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Create study plan
        </Button>
      </div>
    </form>
  );
}
