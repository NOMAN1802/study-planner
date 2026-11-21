"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { HABIT_ICONS } from "@/components/habits/habit-icon";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Fieldset } from "@/components/ui/fieldset";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Frequency } from "@/lib/dates";
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_ICON,
  FREQUENCIES,
  HABIT_COLORS,
  HABIT_ICON_NAMES,
} from "@/lib/habit-options";
import { cn } from "@/lib/utils";
import {
  habitFieldErrors,
  habitFormValues,
  habitSchema,
  type HabitFieldErrors,
  type HabitFormState,
} from "@/schemas/habit";

export type HabitFormDefaults = {
  name: string;
  note: string | null;
  color: string;
  icon: string;
  frequency: Frequency;
  targetCount: number | null;
  targetMinutes: number | null;
  activeHours: number[];
};

const EMPTY: HabitFormDefaults = {
  name: "",
  note: null,
  color: DEFAULT_HABIT_COLOR,
  icon: DEFAULT_HABIT_ICON,
  frequency: "DAILY",
  targetCount: null,
  targetMinutes: null,
  activeHours: [],
};

type HabitFormProps = {
  action: (prev: HabitFormState, formData: FormData) => Promise<HabitFormState>;
  defaults?: HabitFormDefaults;
  submitLabel: string;
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

const chip =
  "inline-flex items-center justify-center rounded-sm border border-border bg-surface text-fg-muted transition-colors duration-150 hover:border-border-strong has-checked:border-fg/50 has-checked:bg-surface-2 has-checked:font-medium has-checked:text-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

export function HabitForm({ action, defaults = EMPTY, submitLabel }: HabitFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<HabitFieldErrors>();
  const [frequency, setFrequency] = useState<Frequency>(defaults.frequency);
  const errors = clientErrors ?? state.fieldErrors ?? {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = habitSchema.safeParse(habitFormValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(habitFieldErrors(parsed.error));
      return;
    }
    setClientErrors(undefined);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {state.error ? (
        <p
          role="alert"
          className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Field id="name" label="Name" error={errors.name}>
        <Input
          id="name"
          name="name"
          defaultValue={defaults.name}
          maxLength={60}
          placeholder="e.g. Read 20 pages"
          invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
      </Field>

      <Fieldset id="frequency" legend="Frequency" error={errors.frequency}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FREQUENCIES.map((f) => (
            <label key={f.value} className={cn(chip, "h-9 px-3 text-sm")}>
              <input
                type="radio"
                name="frequency"
                value={f.value}
                defaultChecked={defaults.frequency === f.value}
                onChange={() => setFrequency(f.value)}
                className="sr-only"
              />
              {f.label}
            </label>
          ))}
        </div>
      </Fieldset>

      {frequency === "HOURLY" ? (
        <Fieldset
          id="activeHours"
          legend="Active hours"
          error={errors.activeHours}
          hint="Hours outside this range don't count towards streaks. Leave empty for every hour."
        >
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
            {HOURS.map((h) => (
              <label key={h} className={cn(chip, "h-8 font-mono text-xs tabular-nums")}>
                <input
                  type="checkbox"
                  name="activeHours"
                  value={h}
                  defaultChecked={defaults.activeHours.includes(h)}
                  className="sr-only"
                  aria-label={hourLabel(h)}
                />
                {String(h).padStart(2, "0")}
              </label>
            ))}
          </div>
        </Fieldset>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="targetCount"
          label="Target count per period"
          error={errors.targetCount}
          hint="Optional. Empty means one check-in."
        >
          <Input
            id="targetCount"
            name="targetCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            defaultValue={defaults.targetCount ?? ""}
            invalid={Boolean(errors.targetCount)}
            aria-describedby={errors.targetCount ? "targetCount-error" : "targetCount-hint"}
          />
        </Field>
        <Field
          id="targetMinutes"
          label="Target minutes per period"
          error={errors.targetMinutes}
          hint="Optional"
        >
          <Input
            id="targetMinutes"
            name="targetMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={defaults.targetMinutes ?? ""}
            invalid={Boolean(errors.targetMinutes)}
            aria-describedby={errors.targetMinutes ? "targetMinutes-error" : "targetMinutes-hint"}
          />
        </Field>
      </div>

      <Field id="note" label="Note" error={errors.note}>
        <Textarea
          id="note"
          name="note"
          defaultValue={defaults.note ?? ""}
          maxLength={500}
          rows={3}
          placeholder="Why this habit matters, or how to do it."
          invalid={Boolean(errors.note)}
        />
      </Field>

      <Fieldset id="color" legend="Colour" error={errors.color}>
        <div className="flex flex-wrap gap-2">
          {HABIT_COLORS.map((c) => (
            <label
              key={c.value}
              className="relative inline-flex size-8 items-center justify-center rounded-sm border border-border has-checked:border-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name="color"
                value={c.value}
                defaultChecked={defaults.color === c.value}
                aria-label={c.label}
                className="sr-only"
              />
              <span
                className="size-5 rounded-sm"
                style={{ backgroundColor: c.value }}
                aria-hidden
              />
            </label>
          ))}
        </div>
      </Fieldset>

      <Fieldset id="icon" legend="Icon" error={errors.icon}>
        <div className="grid grid-cols-8 gap-2 sm:flex sm:flex-wrap">
          {HABIT_ICON_NAMES.map((name) => {
            const Icon = HABIT_ICONS[name];
            return (
              <label key={name} className={cn(chip, "size-9")}>
                <input
                  type="radio"
                  name="icon"
                  value={name}
                  defaultChecked={defaults.icon === name}
                  aria-label={name.replace("-", " ")}
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden />
              </label>
            );
          })}
        </div>
      </Fieldset>

      <div className="flex items-center gap-2 border-t border-border pt-5">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <Link
          href="/habits"
          className="inline-flex h-9 items-center rounded-sm px-4 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
