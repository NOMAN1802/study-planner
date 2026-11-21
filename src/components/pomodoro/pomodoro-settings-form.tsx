"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PomodoroSettings } from "@/lib/pomodoro";
import type { PomodoroConfigState } from "@/schemas/pomodoro";

type Props = {
  action: (prev: PomodoroConfigState, formData: FormData) => Promise<PomodoroConfigState>;
  settings: PomodoroSettings;
};

const fields = [
  { name: "focusMinutes", label: "Focus (min)", max: 180 },
  { name: "shortBreakMinutes", label: "Short break (min)", max: 60 },
  { name: "longBreakMinutes", label: "Long break (min)", max: 120 },
  { name: "cyclesBeforeLongBreak", label: "Focus sessions before long break", max: 12 },
] as const;

export function PomodoroSettingsForm({ action, settings }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" aria-label="Timer settings">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.name} id={f.name} label={f.label} error={errors[f.name]}>
            <Input
              id={f.name}
              name={f.name}
              type="number"
              inputMode="numeric"
              min={1}
              max={f.max}
              required
              defaultValue={settings[f.name]}
              invalid={Boolean(errors[f.name])}
              aria-describedby={errors[f.name] ? `${f.name}-error` : undefined}
            />
          </Field>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          name="autoStartNext"
          defaultChecked={settings.autoStartNext}
          className="size-4 rounded-sm accent-(--accent)"
        />
        Start the next phase automatically
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" loading={pending}>
          Save timer settings
        </Button>
        {state.ok ? (
          <p role="status" className="text-xs text-fg-muted">
            Saved. Applies from the next phase.
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-xs text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
