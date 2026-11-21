"use client";

import { useActionState } from "react";
import { updateSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { WEEKDAYS } from "@/lib/habit-options";
import type { SettingsFormState } from "@/schemas/settings";

type SettingsFormProps = {
  timezone: string;
  weekStartsOn: number;
  timezones: string[];
};

export function SettingsForm({ timezone, weekStartsOn, timezones }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateSettings,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const options = timezones.includes(timezone) ? timezones : [timezone, ...timezones];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        id="timezone"
        label="Timezone"
        error={errors.timezone}
        hint="Days, weeks and months for habits are counted in this timezone"
      >
        <Select
          id="timezone"
          name="timezone"
          defaultValue={timezone}
          invalid={Boolean(errors.timezone)}
        >
          {options.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="weekStartsOn" label="Week starts on" error={errors.weekStartsOn}>
        <Select
          id="weekStartsOn"
          name="weekStartsOn"
          defaultValue={String(weekStartsOn)}
          invalid={Boolean(errors.weekStartsOn)}
        >
          {WEEKDAYS.map((day, i) => (
            <option key={day} value={i}>
              {day}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-3 border-t border-border pt-5">
        <Button type="submit" loading={pending}>
          Save settings
        </Button>
        {state.ok ? (
          <p role="status" className="text-sm text-fg-muted">
            Saved.
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
